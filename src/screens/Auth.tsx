import { useState } from "react";
import type { Api } from "../api/types";
import { DEMO_CODE } from "../api/local";
import type { Me } from "../types";
import { Icon } from "../ui";

export function Auth({ api, onDone }: { api: Api; onDone: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!sent) {
        await api.sendCode(email);
        setSent(true);
      } else {
        onDone(await api.verifyCode(email, code));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <div className="logo"><Icon name="check" size={40} stroke={2.4} /></div>
      <div>
        <h1>WatsTheMove</h1>
        <p className="hint" style={{ marginTop: 6 }}>See what's happening. Join in one tap.</p>
      </div>

      {!sent ? (
        <label className="field">
          <Icon name="lock" />
          <input type="email" inputMode="email" autoComplete="email" placeholder="you@uwaterloo.ca" aria-label="UW email"
            value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
      ) : (
        <div className="stack">
          <p className="hint">Enter the 6-digit code sent to {email}</p>
          <label className="field">
            {/* No icon here, and left padding equal to the letter spacing, so the code sits dead centre. */}
            <input className="code-input" style={{ paddingLeft: "0.4em" }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="······"
              aria-label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
          </label>
        </div>
      )}
      <p className="err" role="alert">{error}</p>
      {api.mode === "demo" ? <p className="hint">Demo mode: any @uwaterloo.ca email, code {DEMO_CODE}. Data stays in this browser.</p> : null}

      <div className="bottom-action">
        <button className="primary" disabled={busy || (!sent ? !email : code.length < 6)}>{sent ? "Sign in" : "Send code"}</button>
        {sent ? <button type="button" className="secondary" onClick={() => { setSent(false); setCode(""); setError(""); }}>Use a different email</button> : null}
      </div>
    </form>
  );
}

export function NameStep({ initial, onSave }: { initial: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form className="auth" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSave(name); } finally { setBusy(false); } }}>
      <div>
        <h1>What should friends call you?</h1>
      </div>
      <label className="field">
        <Icon name="people" />
        <input placeholder="First name" aria-label="Your name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="bottom-action">
        <button className="primary" disabled={busy || !name.trim()}>Continue</button>
      </div>
    </form>
  );
}
