import { describe, expect, it, vi } from "vitest";

const req = (origin?: string) => new Request("http://x/api/rooms", { headers: origin ? { origin } : {} });

describe("CORS (mobil WebView kökenleri)", () => {
  it("varsayılan: yalnızca Capacitor/yerel kökenlere izin verir", async () => {
    vi.resetModules();
    delete process.env.CORS_ORIGINS;
    const { corsHeaders } = await import("./http");
    expect(corsHeaders(req("capacitor://localhost"))["Access-Control-Allow-Origin"]).toBe("capacitor://localhost");
    expect(corsHeaders(req("https://localhost"))["Access-Control-Allow-Origin"]).toBe("https://localhost");
    expect(corsHeaders(req("https://evil.example"))["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(req())["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(req("https://evil.example")).Vary).toBe("Origin");
  });
  it("CORS_ORIGINS ile değiştirilebilir; kimlik bilgisi (credentials) izni verilmez", async () => {
    vi.resetModules();
    process.env.CORS_ORIGINS = "https://app.selam.example";
    const { corsHeaders, preflight } = await import("./http");
    expect(corsHeaders(req("https://app.selam.example"))["Access-Control-Allow-Origin"]).toBe("https://app.selam.example");
    expect(corsHeaders(req("capacitor://localhost"))["Access-Control-Allow-Origin"]).toBeUndefined();
    const res = preflight(req("https://app.selam.example"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    delete process.env.CORS_ORIGINS;
  });
});
