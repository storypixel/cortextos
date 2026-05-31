import type { ChildProcessWithoutNullStreams } from 'child_process';

export interface JsonRpcRequest {
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;
type MessageHandler = (message: JsonRpcMessage) => void;

interface PendingRequest {
  resolve: (message: JsonRpcResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * JSON-RPC client over a child process's stdio (codex 0.125+ `--listen stdio://`).
 *
 * Codex app-server in stdio mode speaks newline-delimited JSON-RPC on stdin/stdout —
 * NOT WebSocket-framed. Each message is a single line of JSON followed by `\n`.
 * Replaces the older WsUnixJsonRpcClient (which assumed unix:// was WebSocket-framed;
 * a wrong assumption that caused silent handshake failures on codex 0.125).
 */
export class StdioJsonRpcClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lineBuffer = '';
  private nextId = 1;
  private pending = new Map<number | string, PendingRequest>();
  private handlers: MessageHandler[] = [];
  private closed = false;

  attach(child: ChildProcessWithoutNullStreams): void {
    if (this.child) throw new Error('StdioJsonRpcClient already attached');
    this.child = child;

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => this.ingest(chunk));
    child.stdout.on('end', () => this.handleClose(new Error('stdout ended')));
    child.on('error', (err) => this.handleClose(err));
    child.on('exit', () => this.handleClose(new Error('child exited')));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectAll(new Error('client closed'));
    this.child = null;
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = 30000): Promise<JsonRpcResponse<T>> {
    if (!this.child || this.closed) {
      return Promise.reject(new Error('stdio JSON-RPC client is not connected'));
    }
    const id = this.nextId++;
    const message: JsonRpcRequest = { id, method, params };
    return new Promise<JsonRpcResponse<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (response) => resolve(response as JsonRpcResponse<T>),
        reject,
        timer,
      });
      this.send(message);
    });
  }

  notify(method: string, params?: unknown): void {
    this.send(params === undefined ? { method } : { method, params });
  }

  respond(id: number | string, result: unknown): void {
    this.send({ id, result });
  }

  respondError(id: number | string, code: number, message: string, data?: unknown): void {
    this.send({ id, error: { code, message, data } });
  }

  private send(message: JsonRpcMessage): void {
    if (!this.child || this.closed) {
      throw new Error('stdio JSON-RPC client is not connected');
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private ingest(chunk: string): void {
    this.lineBuffer += chunk;
    let idx: number;
    while ((idx = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, idx).trim();
      this.lineBuffer = this.lineBuffer.slice(idx + 1);
      if (!line) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch (err) {
      for (const handler of this.handlers) {
        handler({
          method: '_parse_error',
          params: { line, error: (err as Error).message },
        } as JsonRpcMessage);
      }
      return;
    }
    if ('id' in message && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if ('error' in message && message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message as JsonRpcResponse);
      }
      return;
    }
    for (const handler of this.handlers) {
      handler(message);
    }
  }

  private handleClose(err: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectAll(err);
    this.child = null;
  }

  private rejectAll(err: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }
}
