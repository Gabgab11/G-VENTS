'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  length?: number;
  onComplete?: (code: string) => void;
};

export default function OtpInput({ length = 6, onComplete }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRef = useRef<HTMLInputElement>(null);
  const onCompleteRef = useRef(onComplete);
  const code = digits.join('');
  const activeIndex = code.length < length ? code.length : -1;

  // Keep the latest callback without re-running the effect below.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Fire only when the code itself changes to a full set of digits.
  useEffect(() => {
    if (code.length === length) onCompleteRef.current?.(code);
  }, [code, length]);

  // Open the keyboard when the code step appears.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    const clean = value.replace(/\D/g, '').slice(0, length);
    setDigits(Array.from({ length }, (_, i) => clean[i] ?? ''));
  }

  return (
    <div className="otp-wrap" onClick={() => inputRef.current?.focus()}>
      <div className="otp-fan">
        {digits.map((d, i) => {
          const offset = i - (length - 1) / 2;
          return (
            <div
              key={i}
              className={`otp-card${d ? ' filled' : ''}${i === activeIndex ? ' active' : ''}`}
              style={{
                transform: `translateX(${offset * 42}px) rotate(${offset * 9}deg)`,
                zIndex: i,
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        className="otp-hidden"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="One-time code"
      />
    </div>
  );
}
