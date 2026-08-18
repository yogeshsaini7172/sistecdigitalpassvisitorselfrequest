import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── API helpers ───────────────────────────────────────────────────────────────
const api = {
  sendOtp: (phone, campus) =>
    fetch(`${BASE_URL}/visitor-otp-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, campus }),
    }),
  verifyOtp: (phone, otp, campus) =>
    fetch(`${BASE_URL}/visitor-otp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, campus }),
    }),
  selfSubmit: (formData) =>
    fetch(`${BASE_URL}/visitor-self-submit`, { method: 'POST', body: formData }),
};

// ── Steps ────────────────────────────────────────────────────────────────────
const STEPS = ['phone', 'otp', 'details', 'photo', 'success'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const getCampusFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('campus') || params.get('c') || '';
};

// ── Step 1: Phone Input ───────────────────────────────────────────────────────
const StepPhone = ({ campus, onNext }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (phone.length !== 10 || isNaN(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.sendOtp(phone, campus);
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to send OTP.'); return; }
      onNext(phone);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step-body animate-in">
      <div className="step-icon">📱</div>
      <div>
        <h2 className="step-title">Verify your number</h2>
        <p className="step-subtitle">We'll send a 6-digit OTP to confirm your identity before entry.</p>
      </div>
      {campus && (
        <div className="campus-badge">
          <span>🏫</span>
          <span>{campus}</span>
        </div>
      )}
      <div className="input-group">
        <label className="input-label">Mobile Number</label>
        <div className="input-wrap">
          <span className="input-prefix">+91</span>
          <input
            className="input-field"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            id="phone-input"
            autoFocus
          />
        </div>
      </div>
      {error && <div className="feedback error">⚠️ {error}</div>}
      <button className="btn btn-primary" onClick={handleSend} disabled={loading || phone.length !== 10}>
        {loading ? <><div className="spinner" /> Sending OTP…</> : 'Send OTP →'}
      </button>
    </div>
  );
};

// ── Step 2: OTP Verification ──────────────────────────────────────────────────
const StepOtp = ({ phone, campus, onNext, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const focusBox = (idx) => inputRefs.current[idx]?.focus();

  const handleChange = (idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) focusBox(idx + 1);
    if (next.every(d => d)) handleVerify(next.join(''));
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) focusBox(idx - 1);
    if (e.key === 'ArrowLeft' && idx > 0) focusBox(idx - 1);
    if (e.key === 'ArrowRight' && idx < 5) focusBox(idx + 1);
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const arr = pasted.split('');
      setOtp(arr);
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(phone, code || otp.join(''), campus);
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Invalid OTP.'); setOtp(['','','','','','']); focusBox(0); return; }
      onNext(data.visitorSessionToken);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    try {
      const res = await api.sendOtp(phone, campus);
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setTimer(60);
      setOtp(['','','','','','']);
      focusBox(0);
    } catch {
      setError('Failed to resend. Try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="step-body animate-in">
      <div className="step-icon">🔐</div>
      <div>
        <h2 className="step-title">Enter OTP</h2>
        <p className="step-subtitle">A 6-digit code was sent to <strong>+91 {phone}</strong></p>
      </div>

      <div className="otp-row" onPaste={handlePaste}>
        {otp.map((digit, idx) => (
          <input
            key={idx}
            ref={el => inputRefs.current[idx] = el}
            className={`otp-box${digit ? ' filled' : ''}`}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            autoFocus={idx === 0}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            id={`otp-${idx}`}
          />
        ))}
      </div>

      {error && <div className="feedback error">⚠️ {error}</div>}

      <button
        className="btn btn-primary"
        onClick={() => handleVerify()}
        disabled={loading || otp.some(d => !d)}
      >
        {loading ? <><div className="spinner" /> Verifying…</> : 'Verify OTP →'}
      </button>

      <div className="resend-row">
        {timer > 0
          ? <span>Resend OTP in <strong>{timer}s</strong></span>
          : (
            <>
              <span>Didn't receive it?</span>
              <button className="resend-btn" onClick={handleResend} disabled={resendLoading}>
                {resendLoading ? 'Sending…' : 'Resend OTP'}
              </button>
            </>
          )
        }
      </div>

      <button className="btn btn-ghost" onClick={onBack} style={{ marginTop: '-0.25rem' }}>← Change Number</button>
    </div>
  );
};

// ── Step 3: Visitor Details Form ──────────────────────────────────────────────
const StepDetails = ({ onNext }) => {
  const [form, setForm] = useState({ name: '', numberOfVisitor: '1', reason: '' });
  const [error, setError] = useState('');

  const handle = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleNext = () => {
    if (!form.name.trim()) { setError('Please enter your full name.'); return; }
    if (!form.reason.trim()) { setError('Please describe the reason for your visit.'); return; }
    const count = parseInt(form.numberOfVisitor);
    if (isNaN(count) || count < 1 || count > 20) { setError('Number of visitors must be between 1 and 20.'); return; }
    setError('');
    onNext(form);
  };

  return (
    <div className="step-body animate-in">
      <div className="step-icon">📋</div>
      <div>
        <h2 className="step-title">Your Details</h2>
        <p className="step-subtitle">Fill in the details below so the security team can process your entry.</p>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="name-input">Full Name *</label>
        <input
          id="name-input"
          className="input-field-full"
          type="text"
          placeholder="E.g. Rajesh Kumar"
          value={form.name}
          onChange={handle('name')}
          autoFocus
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="count-input">Number of Visitors *</label>
        <input
          id="count-input"
          className="input-field-full"
          type="number"
          min="1"
          max="20"
          placeholder="1"
          value={form.numberOfVisitor}
          onChange={handle('numberOfVisitor')}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="reason-input">Reason for Visit *</label>
        <textarea
          id="reason-input"
          className="input-field-full"
          rows={3}
          placeholder="E.g. Meeting with HOD regarding admission enquiry"
          value={form.reason}
          onChange={handle('reason')}
        />
      </div>

      {error && <div className="feedback error">⚠️ {error}</div>}
      <button className="btn btn-primary" onClick={handleNext}>Continue →</button>
    </div>
  );
};

// ── Step 4: Photo Capture ─────────────────────────────────────────────────────
const StepPhoto = ({ sessionToken, form, campus, phone, onSuccess }) => {
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 500 }
      });
      setStream(s);
      setWebcamActive(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 80);
    } catch {
      setError('Camera access denied. Please use the file option or allow camera permission.');
    }
  };

  const stopCam = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setWebcamActive(false);
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 500;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], 'visitor.jpg', { type: 'image/jpeg' });
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
      stopCam();
    }, 'image/jpeg', 0.9);
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImageFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!imageFile) { setError('Please capture or upload your photo.'); return; }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('visitorSessionToken', sessionToken);
      fd.append('visitorData', JSON.stringify({
        name: form.name,
        numberOfVisitor: parseInt(form.numberOfVisitor),
        reason: form.reason,
      }));
      fd.append('img', imageFile, 'visitor.jpg');

      const res = await api.selfSubmit(fd);
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Submission failed. Please try again.'); return; }
      onSuccess(data.requestId);
    } catch {
      setError('Network error. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step-body animate-in">
      <div className="step-icon">📸</div>
      <div>
        <h2 className="step-title">Take a photo</h2>
        <p className="step-subtitle">A clear selfie helps the security guard verify your identity at entry.</p>
      </div>

      {/* Photo Frame */}
      <div className={`photo-frame${preview ? ' has-photo' : ''}`}>
        {webcamActive ? (
          <video ref={videoRef} autoPlay playsInline muted />
        ) : preview ? (
          <img src={preview} alt="Your photo" />
        ) : (
          <div className="photo-placeholder">
            <span className="icon">🤳</span>
            <span className="label">Photo will appear here</span>
          </div>
        )}
      </div>

      {/* Photo Actions */}
      <div className="photo-actions">
        {webcamActive ? (
          <>
            <button className="btn btn-success btn-sm" onClick={snap}>📸 Snap</button>
            <button className="btn btn-ghost btn-sm" onClick={stopCam}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={startCam}>📹 Open Camera</button>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>📁 Upload Photo</button>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }} />

      {preview && !webcamActive && (
        <button className="btn btn-ghost" onClick={() => { setPreview(null); setImageFile(null); }}>
          🔄 Retake Photo
        </button>
      )}

      {error && <div className="feedback error">⚠️ {error}</div>}

      <button
        className="btn btn-success"
        onClick={handleSubmit}
        disabled={!imageFile || loading}
        style={{ marginTop: '0.25rem' }}
      >
        {loading ? <><div className="spinner" /> Submitting…</> : '✓ Submit Visit Request'}
      </button>
    </div>
  );
};

// ── Step 5: Success ───────────────────────────────────────────────────────────
const StepSuccess = ({ requestId }) => (
  <div className="success-screen animate-in">
    <div className="success-ring">✅</div>
    <h2>Request Submitted!</h2>
    <p>Your visit request has been sent to the security desk. Please wait at the gate — a guard will approve your entry shortly.</p>
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Request ID</div>
      <div className="request-id-chip">🎫 #{requestId}</div>
    </div>
    <div className="feedback info" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
      ℹ️ Your request expires in 4 hours if not acted upon.
    </div>
  </div>
);

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const campus = getCampusFromUrl();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [visitorForm, setVisitorForm] = useState(null);
  const [requestId, setRequestId] = useState('');

  // If no campus, show error
  if (!campus) {
    return (
      <div className="app-shell">
        <div className="card">
          <div className="step-body">
            <div className="step-icon" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>⚠️</div>
            <h2 className="step-title">Invalid QR Code</h2>
            <p className="step-subtitle">This QR code is not associated with any campus. Please scan the correct QR code from the security gate.</p>
          </div>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step === 0 ? 'phone' : step);

  return (
    <div className="app-shell">
      {/* Header */}
      <div className="app-header">
        <div className="logo-icon">🛡️</div>
        <div>
          <h1>Digital Pass</h1>
          <p>Secure Visitor Check-in</p>
        </div>
      </div>

      {/* Card */}
      <div className="card">
        {/* Progress Bar */}
        {step !== 'success' && (
          <div className="progress-strip">
            {['phone','otp','details','photo'].map((s, i) => (
              <div
                key={s}
                className={`progress-dot${STEPS.indexOf(step||'phone') > i ? ' done' : STEPS.indexOf(step||'phone') === i ? ' active' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Steps */}
        {(step === 0 || step === 'phone') && (
          <StepPhone campus={campus} onNext={(p) => { setPhone(p); setStep('otp'); }} />
        )}
        {step === 'otp' && (
          <StepOtp
            phone={phone}
            campus={campus}
            onNext={(tok) => { setSessionToken(tok); setStep('details'); }}
            onBack={() => setStep('phone')}
          />
        )}
        {step === 'details' && (
          <StepDetails onNext={(f) => { setVisitorForm(f); setStep('photo'); }} />
        )}
        {step === 'photo' && (
          <StepPhoto
            sessionToken={sessionToken}
            form={visitorForm}
            campus={campus}
            phone={phone}
            onSuccess={(id) => { setRequestId(id); setStep('success'); }}
          />
        )}
        {step === 'success' && <StepSuccess requestId={requestId} />}
      </div>

      <p className="app-footer">Powered by Digital Pass · Secure &amp; Private</p>
    </div>
  );
}
