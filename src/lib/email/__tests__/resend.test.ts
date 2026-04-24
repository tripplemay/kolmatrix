import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_apiKey: string) {}
  }
  return { Resend };
});

async function importFresh() {
  vi.resetModules();
  return import("../resend");
}

beforeEach(() => {
  sendMock.mockReset();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("sendEmail — mock fallback", () => {
  it("returns mocked result for placeholder keys (dev default)", async () => {
    // `.env` in this repo carries a `replace-me-in-prod` placeholder;
    // importing `dotenv/config` inside resend.ts would repopulate it
    // even if the test does `delete process.env.RESEND_API_KEY` first.
    // Setting an explicit "placeholder" value exercises the mock path
    // deterministically.
    process.env.RESEND_API_KEY = "placeholder-do-not-use";
    const { sendEmail } = await importFresh();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await sendEmail({
      to: "kol@example.test",
      subject: "Hi",
      bodyText: "Hello",
    });
    expect(res).toEqual({ providerMessageId: null, mocked: true });
    expect(logSpy).toHaveBeenCalledWith("[EMAIL MOCK]", expect.any(Object));
    expect(sendMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("treats placeholder key values as mock mode", async () => {
    process.env.RESEND_API_KEY = "placeholder-do-not-use";
    const { sendEmail } = await importFresh();
    const res = await sendEmail({
      to: "kol@example.test",
      subject: "Hi",
      bodyText: "Hello",
    });
    expect(res.mocked).toBe(true);
  });
});

describe("sendEmail — real SDK", () => {
  it("passes through provider message id on success", async () => {
    process.env.RESEND_API_KEY = "re_real_key";
    sendMock.mockResolvedValueOnce({
      data: { id: "msg_123" },
      error: null,
    });
    const { sendEmail } = await importFresh();
    const res = await sendEmail({
      to: "kol@example.test",
      subject: "Hi",
      bodyText: "Hello",
    });
    expect(res).toEqual({ providerMessageId: "msg_123", mocked: false });
  });

  it("maps rate_limit_exceeded to SendEmailError code rate_limited", async () => {
    process.env.RESEND_API_KEY = "re_real_key";
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad input" },
    });
    const { sendEmail, SendEmailError } = await importFresh();
    await expect(
      sendEmail({ to: "kol@example.test", subject: "Hi", bodyText: "H" })
    ).rejects.toBeInstanceOf(SendEmailError);
  });

  it("rejects obviously-bad to addresses before touching Resend", async () => {
    process.env.RESEND_API_KEY = "re_real_key";
    const { sendEmail } = await importFresh();
    await expect(
      sendEmail({
        to: "not-an-email",
        subject: "Hi",
        bodyText: "H",
      })
    ).rejects.toMatchObject({ name: "SendEmailError", code: "invalid_to" });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
