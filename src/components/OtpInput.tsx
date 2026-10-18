'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  length?: number;
  onComplete?: (code: string) => void;
};

export default function OtpInput({ length = 6, onComplete }: Props) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onCompleteRef = useRef(onComplete);
  const complete = code.length === length;
  const activeIndex = complete ? -1 : code.length;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (complete) onCompleteRef.current?.(code);
  }, [code, complete]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, length));
  }

  return (
    <div className="otp-wrap" onClick={() => inputRef.current?.focus()}>
      {complete ? (
        <div className="otp-fan">
          {code.split('').map((d, i) => {
            const offset = i - (length - 1) / 2;
            return (
              <div
                key={i}
                className="otp-card"
                style={{
                  transform: `translateX(${offset * 42}px) rotate(${offset * 7}deg)`,
                  zIndex: i,
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="otp-row">
          {Array.from({ length }, (_, i) => (
            <div key={i} className={`otp-slot${i === activeIndex ? ' active' : ''}`}>
              {code[i] ?? ''}
            </div>
          ))}
        </div>
      )}
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
