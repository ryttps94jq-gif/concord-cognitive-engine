'use client';
const actionResult: Record<string, unknown> = {};

export default function Test() {
  return (
    <div>
      {/* comment */}
      {actionResult.riskScore !== undefined && (
        <p>hello</p>
      )}
    </div>
  );
}
