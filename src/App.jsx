import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const ITEMS = [
  // Domain 1: Nervous System Load & Recovery
  { id: "NS_1", domain: "Nervous System Load & Recovery", text: 'I feel wound-up or "on" even when nothing urgent is happening.', positive: false },
  { id: "NS_2", domain: "Nervous System Load & Recovery", text: "I can physically calm myself (breath, heart rate) after a stressful encounter.", positive: true },
  { id: "NS_5", domain: "Nervous System Load & Recovery", text: "I wake in the night with ministry concerns on my mind.", positive: false },
  { id: "NS_7", domain: "Nervous System Load & Recovery", text: "Stress builds up in me over the week without ever fully clearing.", positive: false },
  { id: "NS_10", domain: "Nervous System Load & Recovery", text: "I recover between demands rather than running on fumes.", positive: true },
  // Domain 2: Emotional Regulation & Well-Being
  { id: "ER_1", domain: "Emotional Regulation & Well-Being", text: "I can name what I'm feeling in the moment instead of being controlled by it.", positive: true },
  { id: "ER_2", domain: "Emotional Regulation & Well-Being", text: "A single difficult conversation can throw off the rest of my day.", positive: false },
  { id: "ER_6", domain: "Emotional Regulation & Well-Being", text: "I can feel flat and low in a way that's hard to shake.", positive: false },
  { id: "ER_7", domain: "Emotional Regulation & Well-Being", text: "I continue to experience enjoyment and meaning in my life outside of ministry.", positive: true },
  { id: "ER_10", domain: "Emotional Regulation & Well-Being", text: "I have people I can be honest with about how I'm really doing.", positive: true },
  // Domain 3: Focus & Cognitive Stamina
  { id: "FC_1", domain: "Focus & Cognitive Stamina", text: "I can stay on one task instead of getting distracted.", positive: true },
  { id: "FC_2", domain: "Focus & Cognitive Stamina", text: "By the end of the day, even small decisions feel exhausting.", positive: false },
  { id: "FC_3", domain: "Focus & Cognitive Stamina", text: "I can be fully present with a person in front of me.", positive: true },
  { id: "FC_6", domain: "Focus & Cognitive Stamina", text: "I put off decisions because I don't have the mental energy to make them.", positive: false },
  { id: "FC_7", domain: "Focus & Cognitive Stamina", text: "I can settle into deep, focused work (study, sermon prep, planning) for a reasonable amount of time.", positive: true },
  // Domain 4: Ministry Depletion
  { id: "MD_1", domain: "Ministry Depletion", text: "I can feel emotionally drained by the ongoing demands and responsibilities of ministry.", positive: false },
  { id: "MD_3", domain: "Ministry Depletion", text: "I notice myself becoming more emotionally detached from the people I serve.", positive: false },
  { id: "MD_4", domain: "Ministry Depletion", text: "I feel a sense of accomplishment from my ministry.", positive: true },
  { id: "MD_7", domain: "Ministry Depletion", text: "I can be present to others' suffering without being overwhelmed by it.", positive: true },
  { id: "MD_8", domain: "Ministry Depletion", text: "I'm running on obligation more than genuine calling right now.", positive: false },
];

// Interleaved to screen careless responses. Not scored into any domain.
const ATTENTION_ITEMS = [];

const SCALE = [
  { v: 1, label: "Never" },
  { v: 2, label: "Rarely" },
  { v: 3, label: "Sometimes" },
  { v: 4, label: "Often" },
  { v: 5, label: "Almost always" },
];

const DOMAINS = [...new Set(ITEMS.map((i) => i.domain))];

function shuffledOrder() {
  const domainGroups = DOMAINS.map((d) => {
    const items = ITEMS.filter((i) => i.domain === d).map((i) => ({ ...i, kind: "domain" }));
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return { domain: d, items };
  });
  ATTENTION_ITEMS.forEach((a) => {
    const gi = Math.floor(Math.random() * domainGroups.length);
    const group = domainGroups[gi];
    const pos = Math.floor(Math.random() * (group.items.length + 1));
    group.items.splice(pos, 0, { ...a, kind: "attention", domain: group.domain });
  });
  return domainGroups;
}

// Scoring follows Leigh Richardson's spec: raw 1-5 responses, with items that
// indicate strength/recovery ("positive" items) reverse-scored so a HIGHER
// total consistently means greater strain/depletion. Domain totals run 5-25
// (5 items each), overall runs 20-100 (4 domains).
function scoreCheckin(answers) {
  const domainScores = {};
  DOMAINS.forEach((d) => {
    const items = ITEMS.filter((i) => i.domain === d);
    const vals = items.map((i) => (i.positive ? 6 - answers[i.id] : answers[i.id]));
    domainScores[d] = vals.reduce((a, b) => a + b, 0);
  });
  const composite = Object.values(domainScores).reduce((a, b) => a + b, 0);
  const attentionPassed = ATTENTION_ITEMS.every((a) => answers[a.id] === a.passValue);
  return { domainScores, composite, attentionPassed };
}

// These convert a strain score back into a 0-100 "wellness fill" purely for
// the existing vessel/bar visuals (higher fill = doing better), so the
// pictures still read intuitively even though the underlying number is a
// strain score where higher = more strain.
function domainFillPct(score) {
  return Math.round(100 - ((score - 5) / 20) * 100);
}
function compositeFillPct(score) {
  return Math.round(100 - ((score - 20) / 80) * 100);
}

function levelColor(pct) {
  if (pct >= 70) return "var(--good)";
  if (pct >= 40) return "var(--warn)";
  return "var(--low)";
}
function levelWord(pct) {
  if (pct >= 70) return "Steady";
  if (pct >= 40) return "Uneven";
  return "Running low";
}
function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}
function groupByPerson(checkins) {
  const groups = {};
  (checkins || []).forEach((c) => {
    const key = normalizeName(c.name);
    if (!groups[key]) groups[key] = { name: c.name, entries: [] };
    groups[key].entries.push(c);
  });
  Object.values(groups).forEach((g) =>
    g.entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  );
  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
}
function personHistory(checkins, name, excludeId) {
  return (checkins || [])
    .filter((c) => normalizeName(c.name) === normalizeName(name) && c.id !== excludeId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function Delta({ value }) {
  if (value === 0 || value === undefined) return <span className="plb-mono text-xs opacity-50">no change</span>;
  const up = value > 0;
  // Higher score = more strain now, so an increase is the concerning direction.
  return (
    <span className="plb-mono text-xs" style={{ color: up ? "var(--coral)" : "var(--sage)" }}>
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

function Sparkline({ points, width = 220, height = 48 }) {
  if (!points || points.length < 2) {
    return (
      <div className="text-xs opacity-50 plb-mono" style={{ height }}>
        Not enough entries yet for a trend line.
      </div>
    );
  }
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - (compositeFillPct(p.composite) / 100) * height]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={coords.map((c) => c.join(",")).join(" ")} fill="none" stroke="var(--line)" strokeWidth="2" opacity="0.6" />
      <path d={path} fill="none" stroke="var(--blue)" strokeWidth="2" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={levelColor(compositeFillPct(points[i].composite))} />
      ))}
    </svg>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      .plb-root { --ink:#1E2A47; --paper:#EDE1C8; --paperHi:#F8F2E4; --sage:#7C8B4A; --gold:#B8862F; --coral:#A8542E; --blue:#8A6A2E; --line:#DDCBA0; --good:#7C8B4A; --warn:#C08A2E; --low:#A8542E;
        font-family:'Work Sans',sans-serif; color:var(--ink); background:var(--paper); min-height:100%; }
      .plb-serif { font-family:'Spectral',serif; }
      .plb-mono { font-family:'IBM Plex Mono',monospace; }
      .plb-card { background:var(--paperHi); border:1px solid var(--line); }
      .plb-btn { transition:transform .15s ease; }
      .plb-btn:hover { transform:translateY(-1px); }
      .plb-btn:focus-visible, .plb-focus:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
      .plb-wave { animation:plbWave 3.2s ease-in-out infinite; }
      @keyframes plbWave { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-2px);} }
      @media (prefers-reduced-motion: reduce) { .plb-wave { animation:none; } }
      .plb-fade { animation:plbFade .4s ease both; }
      @keyframes plbFade { from{opacity:0;transform:translateY(4px);} to{opacity:1;transform:translateY(0);} }
      .plb-logo { filter: drop-shadow(0 3px 6px rgba(58,46,31,0.3)); }
    `}</style>
  );
}

function Vessel({ pct, size = 120, label, displayValue }) {
  const fillHeight = (pct / 100) * (size - 16);
  const color = levelColor(pct);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id={`clip-${label}`}>
            <path d={`M8,8 h${size - 16} v${size - 16} a${(size - 16) / 2},10 0 0 1 -${size - 16},0 z`} />
          </clipPath>
        </defs>
        <path d={`M8,8 h${size - 16} v${size - 16} a${(size - 16) / 2},10 0 0 1 -${size - 16},0 z`} fill="none" stroke="var(--ink)" strokeWidth="2" opacity="0.35" />
        <g clipPath={`url(#clip-${label})`}>
          <rect className="plb-wave" x="8" y={8 + (size - 16 - fillHeight)} width={size - 16} height={fillHeight + 20} fill={color} opacity="0.85" />
        </g>
      </svg>
      <div className="text-center">
        <div className="plb-mono text-xs opacity-70">{label}</div>
        <div className="plb-serif text-lg font-semibold" style={{ color }}>{displayValue ?? pct}</div>
      </div>
    </div>
  );
}

function ReservoirBar({ domain, pct, displayValue }) {
  const color = levelColor(pct);
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm">{domain}</span>
        <span className="plb-mono text-xs opacity-70">{displayValue ?? pct}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: "var(--line)" }}>
        <div className="h-2 rounded-full plb-wave" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function App() {
  const isStaffPath = () => window.location.pathname.replace(/\/$/, "") === "/staff";

  const [view, setView] = useState(() => (isStaffPath() ? "reviewer-login" : "landing"));
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState({});
  const [checkinOrder, setCheckinOrder] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [session, setSession] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session && isStaffPath()) setView("reviewer-dashboard");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadCheckins = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErrorMsg(error.message);
    else setCheckins(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) loadCheckins();
  }, [session, loadCheckins]);

  const goToCheckin = () => {
    setErrorMsg("");
    setCheckinOrder(shuffledOrder());
    setView("checkin");
  };

  const missingItems = checkinOrder
    .flatMap((g) => g.items)
    .filter((item) => answers[item.id] === undefined);
  const allAnswered = missingItems.length === 0 && ATTENTION_ITEMS.every((a) => answers[a.id] !== undefined);

  const submitCheckin = async () => {
    setErrorMsg("");
    if (!name.trim()) {
      setErrorMsg("Please enter your name before submitting.");
      return;
    }
    if (!allAnswered) {
      setErrorMsg(`Please answer all questions before submitting (${missingItems.length} left).`);
      return;
    }
    setSaving(true);
    try {
      const { domainScores, composite, attentionPassed } = scoreCheckin(answers);
      const row = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        answers,
        domain_scores: domainScores,
        composite,
        attention_passed: attentionPassed,
        reviewed: false,
        note: "",
      };
      const { error } = await supabase.from("checkins").insert(row);
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setLastResult({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });
      setView("confirm");

      if (row.email) {
        supabase.functions
          .invoke("send-checkin-results", {
            body: { name: row.name, email: row.email, composite: row.composite, domainScores: row.domain_scores },
          })
          .catch(() => {
            // Silent: the check-in itself already succeeded and saved. Email
            // is a nice-to-have on top, not something that should ever block
            // or fail the submission the person already completed.
          });
      }
    } catch (err) {
      setErrorMsg(err?.message || "Something went wrong submitting your check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetCheckinForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setAnswers({});
    setLastResult(null);
    setErrorMsg("");
    setView("landing");
  };

  const markReviewed = async (id, reviewed, note) => {
    const { error } = await supabase.from("checkins").update({ reviewed, note }).eq("id", id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setCheckins((prev) => prev.map((c) => (c.id === id ? { ...c, reviewed, note } : c)));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) setLoginError(error.message);
    else setView("reviewer-dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(isStaffPath() ? "reviewer-login" : "landing");
  };

  const selected = checkins.find((c) => c.id === selectedId);

  return (
    <div className="plb-root w-full min-h-screen">
      <GlobalStyle />
      <div className="max-w-3xl mx-auto px-5 py-10">
        <header className="mb-10 flex items-center gap-4">
          <img src="/logo.png" alt="Brain Performance Center" className="plb-logo w-24 h-24 flex-shrink-0" />
          <div>
            <h1 className="plb-serif text-2xl font-semibold leading-tight">Brain Performance Center</h1>
            <a
              href="https://thebrainperformancecenter.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="plb-mono text-xs opacity-70 block mt-0.5 hover:opacity-100"
              style={{ color: "var(--gold)" }}
            >
              thebrainperformancecenter.com
            </a>
            <div className="plb-mono text-xs opacity-60 mt-0.5">214-329-9017</div>
          </div>
        </header>

        {view === "landing" && (
          <div className="plb-fade">
            <div className="mb-8">
              <h2 className="plb-serif text-xl font-semibold mb-3">Brain Health & Ministry Well-Being Check-In</h2>
              <p className="text-sm opacity-80 leading-relaxed mb-3">
                Ministry asks a great deal of the brain, body, and nervous system. Over time, the ongoing demands of caring for others, making decisions, managing responsibilities, and remaining emotionally available can begin to affect recovery, focus, emotional regulation, and overall well-being.
              </p>
              <p className="text-sm opacity-80 leading-relaxed mb-3">
                This brief check-in is designed to help identify how you have been functioning over the past two weeks. There are no right or wrong answers. Please respond based on your actual experience rather than how you think you should be feeling.
              </p>
              <p className="text-sm opacity-80 leading-relaxed">
                Your responses will help us better understand patterns of strength, strain, and recovery across the ministry team and guide the development of practical brain health strategies and resources to support you in your decision-making, adaptability, execution, and resilience.
              </p>
            </div>
            <div className="grid gap-4">
            <button className="plb-btn plb-card plb-focus text-left rounded-lg p-6" onClick={goToCheckin}>
              <div className="plb-serif text-lg font-semibold mb-1">Click here to start</div>
              <p className="text-sm opacity-80 leading-relaxed">
                A short, private reflection on how the last two weeks have felt: mood, sleep, stress, and energy. Takes about three minutes.
              </p>
            </button>
            <p className="text-xs opacity-60 leading-relaxed mt-2">
              This tool establishes a personal baseline. It is not a diagnostic screening and does not replace a conversation with a doctor or therapist.
            </p>
            </div>
          </div>
        )}

        {view === "checkin" && (
          <div className="plb-fade">
            <div className="plb-card rounded-lg p-5 mb-4">
              <label className="text-sm font-medium block mb-1">Your name</label>
              <input
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent mb-3"
                style={{ borderColor: "var(--line)" }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
              />
              <label className="text-sm font-medium block mb-1">Email</label>
              <input
                type="email"
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent mb-3"
                style={{ borderColor: "var(--line)" }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <label className="text-sm font-medium block mb-1">Phone</label>
              <input
                type="tel"
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent"
                style={{ borderColor: "var(--line)" }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
              <p className="text-xs opacity-60 mt-2">Your answers, including your name, email, and phone number, are confidential and are only seen by the Brain Performance Center coordinator reviewing these entries.</p>
            </div>

            <p className="text-lg font-medium mb-6">Over the past two weeks, how often have you…</p>

            {checkinOrder.map((group) => (
              <div key={group.domain} className="mb-10">
                <div className="plb-serif text-xl font-semibold mb-3 mt-2">{group.domain}</div>
                {group.items.map((item) => (
                  <div key={item.id} className="plb-card rounded-lg p-4 mb-3">
                    <div className="text-base mb-3">{item.text}</div>
                    <div className="flex flex-wrap gap-2">
                      {SCALE.map((s) => (
                        <button
                          key={s.v}
                          className="plb-btn plb-focus text-xs px-3 py-1.5 rounded-full border"
                          style={{
                            borderColor: "var(--line)",
                            background: answers[item.id] === s.v ? "var(--ink)" : "transparent",
                            color: answers[item.id] === s.v ? "var(--paperHi)" : "var(--ink)",
                          }}
                          onClick={() => setAnswers((a) => ({ ...a, [item.id]: s.v }))}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex items-center justify-between mt-6">
              <button className="text-sm opacity-70 plb-focus" onClick={() => setView("landing")}>← Back</button>
              <button
                disabled={saving}
                className="plb-btn plb-focus rounded-full px-6 py-2 text-sm font-medium"
                style={{ background: allAnswered && name.trim() ? "var(--sage)" : "var(--line)", color: "var(--paperHi)", opacity: saving ? 0.6 : 1 }}
                onClick={submitCheckin}
              >
                {saving ? "Saving…" : "Submit"}
              </button>
            </div>
            {errorMsg && (
              <div className="mt-3 text-sm text-right" style={{ color: "var(--coral)" }}>{errorMsg}</div>
            )}
          </div>
        )}

        {view === "confirm" && lastResult && (
          <div className="plb-fade">
            <div className="plb-card rounded-lg p-6 mb-4 text-center">
              <div className="plb-serif text-lg font-semibold mb-1">Thank you, {lastResult.name.split(" ")[0]}</div>
              <p className="text-sm opacity-70 mb-6">Here's a snapshot of today. This is a personal reflection, not a score to measure yourself against.</p>
              {lastResult.email && (
                <p className="text-xs opacity-60 mb-4">A copy of these results has been sent to {lastResult.email}.</p>
              )}
              <div className="flex justify-center mb-6">
                <Vessel
                  pct={compositeFillPct(lastResult.composite)}
                  displayValue={lastResult.composite}
                  size={140}
                  label={levelWord(compositeFillPct(lastResult.composite))}
                />
              </div>
              <div className="text-left max-w-sm mx-auto">
                {DOMAINS.map((d) => (
                  <ReservoirBar
                    key={d}
                    domain={d}
                    pct={domainFillPct(lastResult.domain_scores[d])}
                    displayValue={lastResult.domain_scores[d]}
                  />
                ))}
              </div>
              <p className="text-xs opacity-60 leading-relaxed mt-6 text-left max-w-sm mx-auto">
                Each area is scored 5–25, and your overall number runs 20–100. Higher numbers reflect more strain in that area over the past two weeks; lower numbers reflect steadier functioning. This isn't a diagnosis or a pass/fail score, it's simply a baseline so you and the Brain Performance Center coordinator can watch for patterns over time.
              </p>
            </div>
            <p className="text-xs opacity-60 leading-relaxed mb-4">
              If anything here feels heavier than usual, it's worth a conversation with a colleague, a supervisor, or a licensed professional. The Brain Performance Center coordinator will follow up if a pattern across check-ins suggests that would help.
            </p>
            <button className="plb-btn plb-focus rounded-full px-6 py-2 text-sm font-medium" style={{ background: "var(--ink)", color: "var(--paperHi)" }} onClick={resetCheckinForm}>
              Done
            </button>
          </div>
        )}

        {view === "reviewer-login" && !session && (
          <div className="plb-fade plb-card rounded-lg p-6 max-w-sm">
            <div className="plb-serif text-lg font-semibold mb-2">Brain Performance Staff Log In</div>
            <p className="text-xs opacity-60 mb-4 leading-relaxed">
              Use the Brain Performance Center coordinator account. Ask your Supabase project admin to create it under Authentication → Users if you don't have one yet.
            </p>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                required
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent mb-2"
                style={{ borderColor: "var(--line)" }}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email"
              />
              <input
                type="password"
                required
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent mb-3"
                style={{ borderColor: "var(--line)" }}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
              />
              {loginError && <div className="text-xs mb-2" style={{ color: "var(--coral)" }}>{loginError}</div>}
              <div className="flex items-center justify-between mt-2">
                <button type="button" className="text-sm opacity-70 plb-focus" onClick={() => setView("landing")}>← Back</button>
                <button type="submit" className="plb-btn plb-focus rounded-full px-5 py-2 text-sm font-medium" style={{ background: "var(--blue)", color: "var(--paperHi)" }}>
                  Sign in
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "reviewer-dashboard" && session && (() => {
          const groups = groupByPerson(checkins);
          return (
            <div className="plb-fade">
              <div className="flex items-center justify-between mb-2">
                <div className="plb-serif text-lg font-semibold">Staff ({groups.length})</div>
                <button className="text-xs opacity-60 plb-focus" onClick={handleLogout}>Sign out</button>
              </div>
              <p className="text-xs opacity-60 mb-4 leading-relaxed">
                Scores run 20–100 overall (5–25 per domain). Higher numbers indicate greater strain, not a diagnosis, use these to spot patterns and track change over time rather than as a clinical threshold.
              </p>
              {loading && <div className="text-sm opacity-60">Loading…</div>}
              {!loading && groups.length === 0 && (
                <div className="plb-card rounded-lg p-6 text-sm opacity-70">No check-ins submitted yet.</div>
              )}
              <div className="space-y-2">
                {groups.map((g) => {
                  const latest = g.entries[0];
                  const prev = g.entries[1];
                  const needsReview = g.entries.some((e) => !e.reviewed);
                  return (
                    <button
                      key={g.name}
                      className="plb-btn plb-card plb-focus w-full text-left rounded-lg p-4 flex items-center justify-between"
                      onClick={() => { setSelectedName(g.name); setView("reviewer-person"); }}
                    >
                      <div>
                        <div className="text-sm font-medium">{g.name}</div>
                        <div className="plb-mono text-xs opacity-60">
                          {g.entries.length} check-in{g.entries.length > 1 ? "s" : ""} · last {new Date(latest.created_at).toLocaleDateString()}
                          {needsReview ? " · needs review" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {prev && <Delta value={latest.composite - prev.composite} />}
                        <div className="plb-serif text-lg font-semibold" style={{ color: levelColor(compositeFillPct(latest.composite)) }}>{latest.composite}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {view === "reviewer-person" && session && selectedName && (() => {
          const entries = personHistory(checkins, selectedName, null);
          const sparkPoints = [...entries].reverse();
          return (
            <div className="plb-fade">
              <button className="text-sm opacity-70 plb-focus mb-4 block" onClick={() => setView("reviewer-dashboard")}>← All staff</button>
              <div className="plb-card rounded-lg p-6 mb-4">
                <div className="plb-serif text-lg font-semibold mb-1">{selectedName}</div>
                <div className="plb-mono text-xs opacity-60 mb-4">{entries.length} check-in{entries.length > 1 ? "s" : ""} over time</div>
                <Sparkline points={sparkPoints} />
              </div>
              <div className="space-y-2">
                {entries.map((c, i) => {
                  const prev = entries[i + 1];
                  return (
                    <button
                      key={c.id}
                      className="plb-btn plb-card plb-focus w-full text-left rounded-lg p-4 flex items-center justify-between"
                      onClick={() => { setSelectedId(c.id); setNoteDraft(c.note || ""); setView("reviewer-detail"); }}
                    >
                      <div>
                        <div className="text-sm font-medium">{new Date(c.created_at).toLocaleDateString()}</div>
                        <div className="plb-mono text-xs opacity-60">{c.reviewed ? "Reviewed" : "Needs review"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {prev && <Delta value={c.composite - prev.composite} />}
                        <div className="plb-serif text-lg font-semibold" style={{ color: levelColor(compositeFillPct(c.composite)) }}>{c.composite}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {view === "reviewer-detail" && session && selected && (
          <div className="plb-fade">
            <button className="text-sm opacity-70 plb-focus mb-4 block" onClick={() => setView("reviewer-person")}>← {selected.name}'s history</button>
            <div className="plb-card rounded-lg p-6 mb-4">
              <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                <div>
                  <div className="plb-serif text-lg font-semibold">{selected.name}</div>
                  <div className="plb-mono text-xs opacity-60">{new Date(selected.created_at).toLocaleString()}</div>
                  {(selected.email || selected.phone) && (
                    <div className="text-xs opacity-70 mt-1">
                      {selected.email && <div>{selected.email}</div>}
                      {selected.phone && <div>{selected.phone}</div>}
                    </div>
                  )}
                  {selected.attention_passed === false && (
                    <div className="text-xs mt-1" style={{ color: "var(--coral)" }}>
                      Failed the quality-control check. Treat this entry's scores with caution.
                    </div>
                  )}
                </div>
                <Vessel
                  pct={compositeFillPct(selected.composite)}
                  displayValue={selected.composite}
                  size={100}
                  label={levelWord(compositeFillPct(selected.composite))}
                />
              </div>
              <div className="max-w-sm">
                {DOMAINS.map((d) => (
                  <ReservoirBar
                    key={d}
                    domain={d}
                    pct={domainFillPct(selected.domain_scores[d])}
                    displayValue={selected.domain_scores[d]}
                  />
                ))}
              </div>
            </div>
            <div className="plb-card rounded-lg p-6 mb-4">
              <div className="text-sm font-medium mb-3">Individual answers</div>
              <div className="space-y-2">
                {ITEMS.map((item) => {
                  const val = selected.answers[item.id];
                  const label = SCALE.find((s) => s.v === val)?.label ?? "N/A";
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-4 text-sm pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
                      <span className="opacity-80">{item.text}</span>
                      <span className="plb-mono text-xs whitespace-nowrap opacity-70">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="plb-card rounded-lg p-6">
              <label className="text-sm font-medium block mb-2">Coordinator notes</label>
              <textarea
                className="plb-focus w-full rounded border px-3 py-2 bg-transparent text-sm mb-3"
                style={{ borderColor: "var(--line)", minHeight: "80px" }}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Private notes for follow-up…"
              />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.reviewed} onChange={(e) => markReviewed(selected.id, e.target.checked, noteDraft)} />
                  Marked reviewed
                </label>
                <button
                  className="plb-btn plb-focus rounded-full px-5 py-2 text-sm font-medium"
                  style={{ background: "var(--ink)", color: "var(--paperHi)" }}
                  onClick={() => markReviewed(selected.id, selected.reviewed, noteDraft)}
                >
                  Save note
                </button>
              </div>
            </div>
          </div>
        )}

        {errorMsg && view !== "checkin" && (
          <div className="mt-6 text-xs" style={{ color: "var(--coral)" }}>{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
