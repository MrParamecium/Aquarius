%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImdlbmVyYXRlZF9pbWFnZSIsInJhdGlvbmFsZSI6IlRoaXMgc2VjdGlvbiBpcyBhIGNvbXBhY3QgZm9ybXVsYSB0YWJsZSB3aXRoIG5vIGV4dHJhY3RlZCB0ZXh0Ym9vayBmaWd1cmVzIGF2YWlsYWJsZS4gQSBnZW5lcmF0ZWQgbGVjdHVyZS1ub3RlcyB2aXN1YWwgaXMgdGhlIGNsZWFyZXN0IHdheSB0byBvcmdhbml6ZSB0aGUgaW50ZWdyYWwgZmFtaWxpZXMgaW50byBhIGZhc3QtdXNhYmxlIHBhdHRlcm4gbWFwLiIsImNyYW0iOiJVc2Ugb25lIGNsZWFuIGZvcm11bGEtZmFtaWx5IG1hcCBzbyB0aGUgc3R1ZGVudCBjYW4gbWF0Y2ggYW4gZXhhbSBpbnRlZ3JhbCB0byB0aGUgcmlnaHQgcGF0dGVybiBpbiBzZWNvbmRzLiIsInN0YW5kYXJkIjoiVXNlIHRoZSB2aXN1YWwgdG8gZ3JvdXAgZm9ybXVsYXMgaW50byBhIGZldyB1bmRlcnN0YW5kYWJsZSBmYW1pbGllcyBhbmQgc3VwcG9ydCBvbmUgcmVwcmVzZW50YXRpdmUgd29ya2VkIGV4YW1wbGUuIiwidG9wX3Njb3JlIjoiVXNlIHRoZSB2aXN1YWwgdG8gZXhwb3NlIGxvb2stYWxpa2UgZm9ybXVsYXMsIHBhcmFtZXRlciByb2xlcywgYW5kIHdoZW4gaW50ZWdyYXRpb24gYnkgcGFydHMgaXMgdGhlIHNhZmVyIG1vdmUuIn0=" style="display:none;"></div>%%KC_END%%
# B.8 Indefinite Integrals — Quick Reference

> **Section Objective:** Build fast pattern-recognition for the most common indefinite integral families so that exam problems become a matter of matching, not re-deriving.

---

This subsection is a practical reference, not a derivation chapter. You will learn to recognize the main antiderivative families, know when integration by parts is the right move, and verify any result in seconds by differentiating it. On exams, many integration problems are straightforward once you match the integrand's shape to a known pattern — that matching skill is exactly what this section trains. The main groups covered here are: **trigonometric forms**, **exponential forms**, **product forms** (handled by integration by parts), and **rational forms** that yield arctan or logarithm results.

## 1. How to Use the Table Efficiently

The goal is **shape matching**, not blind memorization. Before writing anything, ask: what family does this integrand belong to?

### WORKED EXAMPLE — INTEGRATION BY PARTS

Consider \(\int x\cos(ax)\,dx\). The integrand is a product of an algebraic factor \(x\) and a trig factor \(\cos(ax)\) — a classic integration-by-parts signal.

**Setup:** Choose \(u = x\) and \(dv = \cos(ax)\,dx\).

Then \(du = dx\) and \(v = \dfrac{1}{a}\sin(ax)\).

Applying \(\int u\,dv = uv - \int v\,du\):

$$
\int x\cos(ax)\,dx = \frac{x}{a}\sin(ax) - \int \frac{1}{a}\sin(ax)\,dx = \frac{1}{a^2}\bigl(\cos(ax) + ax\sin(ax)\bigr) + C
$$

This matches the table entry exactly.

### EXAM TIP

Any product of \(x\) (or a polynomial) with a trig or exponential factor almost always calls for integration by parts. Recognize the shape first, then apply the formula mechanically.

$$\int u\,dv = uv - \int v\,du$$
*Integration by parts converts a difficult product integral into a new integral that is usually simpler, by trading the original product structure for a differentiated factor and a new antiderivative.*

## 2. High-Yield Antiderivative Patterns

---

### TRIG PATTERNS

The antiderivatives of \(\sin(ax)\) and \(\cos(ax)\) differ by a **sign flip**:

- \(\int \sin(ax)\,dx = -\dfrac{1}{a}\cos(ax) + C\)
- \(\int \cos(ax)\,dx = +\dfrac{1}{a}\sin(ax) + C\)

The factor \(\dfrac{1}{a}\) appears in both — it compensates for the chain-rule factor \(a\) that differentiation would produce.

### EXPONENTIAL PATTERNS

For \(\int e^{ax}\,dx\), the parameter \(a\) always ends up in the **denominator**: result is \(\dfrac{1}{a}e^{ax} + C\). For mixed forms like \(\int e^{ax}\sin(bx)\,dx\), both \(a\) and \(b\) appear and the denominator becomes \(a^2 + b^2\).

### RATIONAL PATTERNS

Two similar-looking integrals lead to completely different results:

- \(\int \dfrac{dx}{x^2+a^2}\) → **arctan**, because the numerator is a constant.
- \(\int \dfrac{x\,dx}{x^2+a^2}\) → **logarithm**, because \(x\) in the numerator is proportional to the derivative of \(x^2+a^2\).

#### Quick Check

Whenever possible, differentiate your final answer mentally — this catches sign errors and missing \(\dfrac{1}{a}\) factors in seconds.

$$\int \frac{dx}{x^2+a^2} = \frac{1}{a}\tan^{-1}\!\left(\frac{x}{a}\right) + C \qquad \int \frac{x\,dx}{x^2+a^2} = \frac{1}{2}\ln(x^2+a^2) + C$$
*These two similar-looking rational integrals lead to different antiderivatives — arctan versus logarithm — because the numerator structure is different: a constant numerator triggers the arctan form, while a numerator proportional to the derivative of the denominator triggers the logarithm form.*

---
**📌 Key Takeaways**
- Match the integrand's shape to a formula family before computing anything.
- Use integration by parts whenever the integrand is a product of polynomial and trig or exponential.
- Always add \(+C\) and verify by differentiating the result to catch sign or factor errors.

*In the next section we will move to the next background tool in the appendix.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InBhdHRlcm5fcmVjb2duaXRpb24iLCJsYWJlbCI6Ik1hdGNoIGFuIGludGVncmFuZCB0byB0aGUgY29ycmVjdCBmb3JtdWxhIGZhbWlseSIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJoaWdoIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoyfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwMV9xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hpY2ggbWV0aG9kIGlzIHRoZSBiZXN0IGZpcnN0IGNob2ljZSBmb3IgXFwoXFxpbnQgeFxcY29zKGF4KVxcLGR4XFwpPyIsIm9wdGlvbnMiOlsiQS4gRGlyZWN0IHN1YnN0aXR1dGlvbiIsIkIuIEludGVncmF0aW9uIGJ5IHBhcnRzIiwiQy4gUGFydGlhbCBmcmFjdGlvbnMiLCJELiBMJ0hvcGl0YWwncyBSdWxlIl0sImNvcnJlY3Rfb3B0aW9uIjoiQiIsImV4cGxhbmF0aW9uIjoiQSBwcm9kdWN0IG9mIGFuIGFsZ2VicmFpYyBmYWN0b3IgYW5kIGEgdHJpZyBmYWN0b3IgaXMgYSBzdGFuZGFyZCBpbnRlZ3JhdGlvbi1ieS1wYXJ0cyBwYXR0ZXJuLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6Ik5vIG9idmlvdXMgaW5uZXIgZnVuY3Rpb24gbWFrZXMgc3Vic3RpdHV0aW9uIHRoZSBuYXR1cmFsIGZpcnN0IG1vdmUuIiwiQyI6IlBhcnRpYWwgZnJhY3Rpb25zIGlzIGZvciByYXRpb25hbCBleHByZXNzaW9ucywgbm90IHRoaXMgcHJvZHVjdC4iLCJEIjoiTCdIb3BpdGFsJ3MgUnVsZSBpcyBmb3IgbGltaXRzLCBub3QgaW5kZWZpbml0ZSBpbnRlZ3JhbHMuIn0sImhpbnQiOiJMb29rIGZvciBhIHByb2R1Y3Qgd2hlcmUgZGlmZmVyZW50aWF0aW5nIG9uZSBmYWN0b3IgbWFrZXMgaXQgc2ltcGxlci4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9LHsiaWQiOiJrcDFfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGFudGlkZXJpdmF0aXZlIGZhbWlseSBtYXRjaGVzIFxcKFxcaW50IFxcZnJhY3t4fXt4XjIrYV4yfVxcLGR4XFwpPyIsIm9wdGlvbnMiOlsiQS4gQXJjdGFuZ2VudCBmb3JtIiwiQi4gTG9nYXJpdGhtIGZvcm0iLCJDLiBJbnRlZ3JhdGlvbiBieSBwYXJ0cyBmb3JtIiwiRC4gVHJpZy1wcm9kdWN0IGZvcm0iXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJUaGUgbnVtZXJhdG9yIFxcKHhcXCkgaXMgcHJvcG9ydGlvbmFsIHRvIHRoZSBkZXJpdmF0aXZlIG9mIHRoZSBkZW5vbWluYXRvciBcXCh4XjIrYV4yXFwpLCBzbyB0aGUgcmVzdWx0IGlzIGxvZ2FyaXRobWljLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IkFyY3RhbmdlbnQgYXBwZWFycyBmb3IgXFwoXFxpbnQgZHgvKHheMithXjIpXFwpLCBub3Qgd2hlbiBcXCh4XFwpIGlzIGluIHRoZSBudW1lcmF0b3IuIiwiQyI6IkludGVncmF0aW9uIGJ5IHBhcnRzIGlzIHVubmVjZXNzYXJ5IGhlcmUuIiwiRCI6IlRoaXMgaXMgbm90IGEgdHJpZyBwcm9kdWN0LiJ9LCJoaW50IjoiQXNrIHdoZXRoZXIgdGhlIG51bWVyYXRvciBsb29rcyBsaWtlIHRoZSBkZXJpdmF0aXZlIG9mIHRoZSBkZW5vbWluYXRvci4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6ImNvcmVfZm9ybXVsYV9hY2N1cmFjeSIsImxhYmVsIjoiVXNlIHN0YW5kYXJkIHRyaWcgYW5kIGV4cG9uZW50aWFsIGFudGlkZXJpdmF0aXZlcyBhY2N1cmF0ZWx5IiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AyX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGF0IGlzIFxcKFxcaW50IFxcc2luKGF4KVxcLGR4XFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoXFxmcmFjezF9e2F9XFxjb3MoYXgpK0NcXCkiLCJCLiBcXCgtXFxmcmFjezF9e2F9XFxjb3MoYXgpK0NcXCkiLCJDLiBcXChhXFxjb3MoYXgpK0NcXCkiLCJELiBcXCgtXFxmcmFjezF9e2F9XFxzaW4oYXgpK0NcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJEaWZmZXJlbnRpYXRpbmcgXFwoLVxcZnJhY3sxfXthfVxcY29zKGF4KVxcKSBnaXZlcyBcXChcXHNpbihheClcXCksIGNvbmZpcm1pbmcgdGhpcyBpcyBjb3JyZWN0LiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoZSBzaWduIGlzIHdyb25nOyBkaWZmZXJlbnRpYXRpbmcgXFwoXFxmcmFjezF9e2F9XFxjb3MoYXgpXFwpIGdpdmVzIFxcKC1cXHNpbihheClcXCkuIiwiQyI6IlRoZSBmYWN0b3Igb2YgXFwoYVxcKSBpcyB3cm9uZyBhbmQgdGhlIHNpZ24gaXMgYWxzbyB3cm9uZy4iLCJEIjoiRGlmZmVyZW50aWF0aW5nIFxcKC1cXGZyYWN7MX17YX1cXHNpbihheClcXCkgZ2l2ZXMgXFwoLVxcY29zKGF4KVxcKSwgbm90IFxcKFxcc2luKGF4KVxcKS4ifSwiaGludCI6IkRpZmZlcmVudGlhdGUgZWFjaCBvcHRpb24gbWVudGFsbHkuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AyX3EyIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGF0IGlzIFxcKFxcaW50IGVee2F4fVxcLGR4XFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoYWVee2F4fStDXFwpIiwiQi4gXFwoZV57YXh9K0NcXCkiLCJDLiBcXChcXGZyYWN7MX17YX1lXntheH0rQ1xcKSIsIkQuIFxcKFxcZnJhY3sxfXt4fWVee2F4fStDXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiRGlmZmVyZW50aWF0aW5nIFxcKFxcZnJhY3sxfXthfWVee2F4fVxcKSByZXR1cm5zIFxcKGVee2F4fVxcKSwgY29uZmlybWluZyB0aGUgXFwoXFxmcmFjezF9e2F9XFwpIGZhY3RvciBpcyBjb3JyZWN0LiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IkRpZmZlcmVudGlhdGluZyBcXChhZV57YXh9XFwpIGdpdmVzIFxcKGFeMiBlXntheH1cXCksIHRvbyBsYXJnZSBieSBhIGZhY3RvciBvZiBcXChhXFwpLiIsIkIiOiJEaWZmZXJlbnRpYXRpbmcgXFwoZV57YXh9XFwpIGdpdmVzIFxcKGFlXntheH1cXCksIHNvIGEgZGVub21pbmF0b3IgZmFjdG9yIG9mIFxcKGFcXCkgaXMgbWlzc2luZy4iLCJEIjoiVGhlIGZhY3RvciBcXChcXGZyYWN7MX17eH1cXCkgaGFzIG5vIGJhc2lzIGluIHRoZSBjaGFpbiBydWxlIGhlcmUuIn0sImhpbnQiOiJVbmRvIHRoZSBjaGFpbiBydWxlIGZhY3RvciBcXChhXFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9XX0seyJpZCI6IndvcmtlZF9leGFtcGxlX2FuZF9jaGVjayIsImxhYmVsIjoiSW50ZXJwcmV0IGFuZCB2ZXJpZnkgYSByZXByZXNlbnRhdGl2ZSBmb3JtdWxhIGZyb20gdGhlIHRhYmxlIiwiaW1wb3J0YW5jZSI6Im1lZGl1bSIsImV4YW1fd2VpZ2h0IjoibWVkaXVtIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoxfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwM19xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hpY2ggZXhwcmVzc2lvbiBpcyBhbiBhbnRpZGVyaXZhdGl2ZSBvZiBcXCh4XFxjb3MoYXgpXFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoXFxmcmFjezF9e2FeMn0oXFxjb3MoYXgpK2F4XFxzaW4oYXgpKStDXFwpIiwiQi4gXFwoXFxmcmFjezF9e2FeMn0oXFxzaW4oYXgpK2F4XFxjb3MoYXgpKStDXFwpIiwiQy4gXFwoXFxmcmFjezF9e2F9KFxcY29zKGF4KSt4XFxzaW4oYXgpKStDXFwpIiwiRC4gXFwoeFxcc2luKGF4KStDXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQSIsImV4cGxhbmF0aW9uIjoiVGhpcyBpcyB0aGUgdGFibGUgcmVzdWx0IGFuZCBkaWZmZXJlbnRpYXRlcyBiYWNrIHRvIFxcKHhcXGNvcyhheClcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJCIjoiVGhlIHRyaWcgZnVuY3Rpb25zIGFyZSBwbGFjZWQgaW5jb3JyZWN0bHk7IGRpZmZlcmVudGlhdGlvbiBkb2VzIG5vdCBzaW1wbGlmeSB0byB0aGUgdGFyZ2V0IGludGVncmFuZC4iLCJDIjoiVGhlIHNjYWxpbmcgaXMgaW5jb3JyZWN0OyB0aGUgY2hhaW4tcnVsZSBmYWN0b3JzIGRvIG5vdCBjYW5jZWwgcHJvcGVybHkuIiwiRCI6IkRpZmZlcmVudGlhdGlvbiBnaXZlcyBleHRyYSB0ZXJtcyBhbmQgdGhlIHdyb25nIGNvZWZmaWNpZW50IHN0cnVjdHVyZS4ifSwiaGludCI6IlRoZSBjb3JyZWN0IGFuc3dlciBzaG91bGQgc3Vydml2ZSBhIHF1aWNrIGRlcml2YXRpdmUgY2hlY2suIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50IjpmYWxzZX0seyJpZCI6ImtwM19xMiIsInR5cGUiOiJzaG9ydF9hbnN3ZXIiLCJzdGVtIjoiV2h5IGlzIGEgcXVpY2sgZGlmZmVyZW50aWF0aW9uIGNoZWNrIGVzcGVjaWFsbHkgdXNlZnVsIHdoZW4gdXNpbmcgYSBmb3JtdWxhIHRhYmxlIG9mIGluZGVmaW5pdGUgaW50ZWdyYWxzPyIsImlkZWFsX2Fuc3dlciI6IkJlY2F1c2UgbWFueSB0YWJsZSBlbnRyaWVzIGRpZmZlciBvbmx5IGJ5IGEgc2lnbiwgZmFjdG9yLCBvciBwYXJhbWV0ZXIgaW4gdGhlIGRlbm9taW5hdG9yLCBhbmQgZGlmZmVyZW50aWF0aW5nIHRoZSByZXN1bHQgcXVpY2tseSBjYXRjaGVzIHRob3NlIG1pc3Rha2VzLiIsImdyYWRpbmdfcnVicmljIjpbIk11c3QgbWVudGlvbiBjaGVja2luZyBzaWduLCBmYWN0b3IsIG9yIHBhcmFtZXRlciBlcnJvcnMiLCJNdXN0IG1lbnRpb24gZGlmZmVyZW50aWF0aW5nIHRoZSBwcm9wb3NlZCBhbnRpZGVyaXZhdGl2ZSIsIk11c3QgY29ubmVjdCB0aGUgY2hlY2sgdG8gZm9ybXVsYS10YWJsZSB1c2UiXSwiZXhwbGFuYXRpb24iOiJUaGlzIHRlc3RzIHdoZXRoZXIgdGhlIHN0dWRlbnQgdW5kZXJzdGFuZHMgaG93IHRvIHVzZSB0aGUgdGFibGUgc2FmZWx5IHJhdGhlciB0aGFuIGNvcHlpbmcgZm9ybXVsYXMgYmxpbmRseS4iLCJoaW50IjoiVGhpbmsgYWJvdXQgdGhlIG1vc3QgY29tbW9uIG1pc3Rha2VzIGluIGFudGlkZXJpdmF0aXZlcy4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19XX0=" style="display:none;"></div>%%KC_END%%
