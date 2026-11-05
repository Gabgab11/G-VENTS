'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  length?: number;
  onComplete?: (code: string) => void;
  // Set to true when the code was rejected. The boxes clear, turn red and refocus.
  invalid?: boolean;
};

export default function OtpInput({ length = 6, onComplete, invalid = false }: Props) {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
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

  // A rejected code: clear the boxes, show them in red, and start again.
  useEffect(() => {
    if (invalid) {
      setCode('');
      setWrong(true);
      inputRef.current?.focus();
    }
  }, [invalid]);

  function handleChange(value: string) {
    setWrong(false);
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
            <div
              key={i}
              className={`otp-slot${i === activeIndex ? ' active' : ''}${wrong ? ' bad' : ''}`}
              aria-hidden="true"
            >
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
