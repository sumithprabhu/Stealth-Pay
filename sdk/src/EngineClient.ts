import {
  EngineShieldResponse,
  EngineUnshieldResponse,
  EnginePrivateTransferResponse,
  EngineBalanceResponse,
  StealthPayError,
} from "./types";

export class EngineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async notifyShield(
    owner:      string,
    token:      string,
    amount:     bigint,
    commitment: string,
  ): Promise<EngineShieldResponse> {
    return this._post<EngineShieldResponse>("/shield", {
      owner,
      token,
      amount: amount.toString(),
      commitment,
    });
  }

  async requestUnshield(
    commitment: string,
    recipient:  string,
  ): Promise<EngineUnshieldResponse> {
    return this._post<EngineUnshieldResponse>("/unshield", { commitment, recipient });
  }

  async requestPrivateTransfer(
    senderCommitment:   string,
    receiverAddress:    string,
    token:              string,
    amount:             bigint,
  ): Promise<EnginePrivateTransferResponse> {
    return this._post<EnginePrivateTransferResponse>("/private-transfer", {
      senderCommitment,
      receiverAddress,
      token,
      amount: amount.toString(),
    });
  }

  async getBalance(owner: string, token: string): Promise<EngineBalanceResponse> {
    return this._get<EngineBalanceResponse>(`/balance/${owner}/${token}`);
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async _post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":    this.apiKey,
      },
      body: JSON.stringify(body),
    });
    return this._parse<T>(res);
  }

  private async _get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "x-api-key": this.apiKey },
    });
    return this._parse<T>(res);
  }

  private async _parse<T>(res: Response): Promise<T> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new StealthPayError(
        `Engine returned non-JSON (status ${res.status})`,
        "ENGINE_PARSE_ERROR",
      );
    }

    if (!res.ok) {
      const msg = (json as { error?: string }).error ?? res.statusText;
      throw new StealthPayError(msg, "ENGINE_REQUEST_FAILED");
    }

    return json as T;
  }
}
