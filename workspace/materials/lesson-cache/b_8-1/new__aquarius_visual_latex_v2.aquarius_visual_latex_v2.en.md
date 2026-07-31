%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImdlbmVyYXRlZF9pbWFnZSIsInJhdGlvbmFsZSI6IlRoaXMgYXBwZW5kaXggcGFnZSBoYXMgbm8gZXh0cmFjdGVkIGZpZ3VyZXMsIGJ1dCB0aGUgY29tcGxleC1udW1iZXIgZm9ybXVsYXMgYXJlIG11Y2ggZWFzaWVyIHRvIHVuZGVyc3RhbmQgd2l0aCBhIGNsZWFuIGdlbmVyYXRlZCB0ZWFjaGluZyBkaWFncmFtIHRoYW4gd2l0aCB0ZXh0IGFsb25lLiBUaGUgY29uc3RhbnRzIGNhbiBzdGF5IHRleHQtYmFzZWQsIHdoaWxlIHRoZSBjb21wbGV4LW51bWJlciByZWxhdGlvbnNoaXBzIHNob3VsZCBiZSB2aXN1YWxpemVkLiIsImNyYW0iOiJVc2UgdGhlIHZpc3VhbCB0byBoZWxwIHRoZSBzdHVkZW50IGluc3RhbnRseSByZWNvZ25pemUgRXVsZXIgZm9ybSwgcmVjdGFuZ3VsYXItdG8tcG9sYXIgY29udmVyc2lvbiwgYW5kIGFuZ2xlLWFkZGl0aW9uIGluIG11bHRpcGxpY2F0aW9uLiIsInN0YW5kYXJkIjoiVXNlIHRoZSB2aXN1YWwgdG8gY29ubmVjdCB0aGUgZm9ybXVsYXMgdG8gb25lIGNsZWFyIGNvbXBsZXgtcGxhbmUgcGljdHVyZSBhbmQgb25lIHJlcHJlc2VudGF0aXZlIG11bHRpcGxpY2F0aW9uIGV4YW1wbGUuIiwidG9wX3Njb3JlIjoiVXNlIHRoZSB2aXN1YWwgdG8gaGlnaGxpZ2h0IHdoYXQgY2hhbmdlcyB1bmRlciBwb3dlcnMgYW5kIG11bHRpcGxpY2F0aW9uOiBtYWduaXR1ZGUgbXVsdGlwbGllcywgYW5nbGVzIGFkZCwgYW5kIHJlY3Rhbmd1bGFyL3BvbGFyIGZvcm1zIGRlc2NyaWJlIHRoZSBzYW1lIG51bWJlci4ifQ==" style="display:none;"></div>%%KC_END%%
# B.8-1: Constants and Complex-Number Identities — Quick Reference

> **Section Objective:** Build instant recall of a compact set of numerical constants and complex-number identities that appear repeatedly in later derivations — without re-proving them each time.

This appendix subsection is a **reference sheet**, not a derivation. There are three things to take away:

1. A handful of numerical constants worth recognizing on sight.
2. A small set of complex-number identities — especially Euler's formula and its special cases.
3. The rectangular-to-polar conversion and the multiplication rules for exponential form.

Later chapters will invoke these facts silently. Knowing them cold means you spend your problem-solving time on the actual work, not on re-deriving basics.

## 1. Useful Constants to Recognize Fast

The appendix lists five constants you should be able to place on a number line without hesitation:

| Constant | Approximate Value |
|---|---|
| \(\pi\) | \(3.14159\) |
| \(e\) | \(2.71828\) |
| \(1/e\) | \(0.36788\) |
| \(\log_{10} 2\) | \(0.30103\) |
| \(\log_{10} 3\) | \(0.47712\) |

You do **not** need to memorize many decimal places. The exam value is quick recognition and rough estimation.

### PRACTICAL EXAMPLE

If a logarithm expression contains \(\log_{10} 2\), substitute \(0.301\) immediately as a shortcut step — no calculator needed.

### EXAM TIP

\(\pi\) and \(e\) are the most critical anchors. The log values are practical shortcuts that save time in decibel and frequency calculations.

## 2. Core Complex-Number Identities

The imaginary unit \(j\) marks the **vertical axis** of the complex plane. Every complex number has a real (horizontal) part and an imaginary (vertical) part.

**Euler's formula** is the master identity:

$$
e^{\pm j\theta} = \cos\theta \pm j\sin\theta
$$

All other identities on this page are special cases.

### KEY SPECIAL CASES

- When \(\theta = \pi/2\): \(\cos(\pi/2) + j\sin(\pi/2) = 0 + j(1) = j\), so \(e^{j\pi/2} = j\).
- Similarly, \(e^{-j\pi/2} = -j\).
- For integer \(n\): \(e^{\pm jn\pi}\) alternates between \(+1\) (even \(n\)) and \(-1\) (odd \(n\)), because angles of \(n\pi\) always land on the **real axis**.

### QUICK CHECK

Notice that \(n\pi\) always lands on the real axis — the imaginary part is zero. This is why \(e^{jn\pi}\) is always a real number, never \(j\) or \(-j\).

$$e^{\pm j\theta} = \cos\theta \pm j\sin\theta$$
*This formula connects the exponential form \(e^{\pm j\theta}\) directly to the rectangular-axis components \(\cos\theta\) (real part) and \(\pm\sin\theta\) (imaginary part) of the same complex number.*

## 3. Rectangular Form, Polar Form, and Multiplication Rules

The expressions \(a + jb\) and \(re^{j\theta}\) are **two descriptions of the same complex number**:

- \(a\) = horizontal distance (real part)
- \(b\) = vertical distance (imaginary part)
- \(r\) = distance from the origin (magnitude)
- \(\theta\) = angle from the positive real axis (phase)

### OPERATION RULES IN EXPONENTIAL FORM

Exponential form makes two operations especially clean:

**Power rule:** \((re^{j\theta})^k = r^k e^{jk\theta}\) — the magnitude is raised to the power \(k\) and the angle is scaled by \(k\).

**Multiplication rule:** \((r_1 e^{j\theta_1})(r_2 e^{j\theta_2}) = r_1 r_2\, e^{j(\theta_1 + \theta_2)}\) — magnitudes multiply, angles add.

### WORKED EXAMPLE

Multiplying \(2e^{j30^\circ}\) by \(3e^{j20^\circ}\):
- Magnitudes: \(2 \times 3 = 6\)
- Angles: \(30^\circ + 20^\circ = 50^\circ\)
- Result: \(6e^{j50^\circ}\)

### EXAM TIP

In exponential form: **magnitudes multiply, angles add.** This is the single most useful rule for simplifying complex-number products and powers.

$$a + jb = re^{j\theta}, \quad r = \sqrt{a^2 + b^2}, \quad \theta = \tan^{-1}\left(\frac{b}{a}\right)$$
*This formula converts a complex number from rectangular coordinates \((a, b)\) into magnitude-angle (polar) form, where \(r\) is the distance from the origin and \(\theta\) is the angle from the positive real axis — both describing the same complex number.*

$$(re^{j\theta})^k = r^k e^{jk\theta}, \qquad (r_1 e^{j\theta_1})(r_2 e^{j\theta_2}) = r_1 r_2 e^{j(\theta_1 + \theta_2)}$$
*Raising to a power \(k\) scales both the magnitude by \(r^k\) and the angle by \(k\theta\); multiplying two complex numbers in exponential form multiplies their magnitudes and adds their angles.*

---
**📌 Key Takeaways**
- Key constants — \(\pi\), \(e\), \(1/e\), \(\log_{10}2\), \(\log_{10}3\) — are reference values for quick numerical substitution.
- Euler's formula \(e^{j\theta} = \cos\theta + j\sin\theta\) is the master identity; \(e^{j\pi/2} = j\) and \(e^{jn\pi} = \pm 1\) are its most-used special cases.
- In polar form, powers scale magnitude and angle by \(k\); multiplication multiplies magnitudes and adds angles.

*In the next section we will use these reference formulas as tools instead of re-deriving them.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InVzZWZ1bF9jb25zdGFudHNfcmVjYWxsIiwibGFiZWwiOiJSZWNvZ25pemluZyB0aGUgbGlzdGVkIGNvbnN0YW50cyIsImltcG9ydGFuY2UiOiJtZWRpdW0iLCJleGFtX3dlaWdodCI6Im1lZGl1bSIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDFfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGFwcHJveGltYXRpb24gaXMgbGlzdGVkIGNvcnJlY3RseSBpbiB0aGUgYXBwZW5kaXg/Iiwib3B0aW9ucyI6WyJBLiBcXChlIFxcYXBwcm94IDMuMTQxNTlcXCkiLCJCLiBcXChcXGxvZ197MTB9IDIgXFxhcHByb3ggMC4zMDEwM1xcKSIsIkMuIFxcKDEvZSBcXGFwcHJveCAyLjcxODI4XFwpIiwiRC4gXFwoXFxsb2dfezEwfSAzIFxcYXBwcm94IDAuMzAxMDNcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJUaGUgYXBwZW5kaXggbGlzdHMgXFwoXFxsb2dfezEwfSAyIFxcYXBwcm94IDAuMzAxMDNcXCkuIFRoaXMgaXMgdGhlIGNvcnJlY3QgcGFpcmluZyBvZiBjb25zdGFudCBhbmQgdmFsdWUuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiXFwoMy4xNDE1OVxcKSBpcyB0aGUgYXBwcm94aW1hdGlvbiBvZiBcXChcXHBpXFwpLCBub3QgXFwoZVxcKS4gVGhlIHZhbHVlIG9mIFxcKGVcXCkgaXMgYXBwcm94aW1hdGVseSBcXCgyLjcxODI4XFwpLiIsIkMiOiJcXCgyLjcxODI4XFwpIGlzIFxcKGVcXCkgaXRzZWxmLiBUaGUgdmFsdWUgb2YgXFwoMS9lXFwpIGlzIGFwcHJveGltYXRlbHkgXFwoMC4zNjc4OFxcKS4iLCJEIjoiXFwoXFxsb2dfezEwfSAzIFxcYXBwcm94IDAuNDc3MTJcXCksIG5vdCBcXCgwLjMwMTAzXFwpLiBUaGUgdmFsdWUgXFwoMC4zMDEwM1xcKSBiZWxvbmdzIHRvIFxcKFxcbG9nX3sxMH0gMlxcKS4ifSwiaGludCI6IktlZXAgdGhlIGZpdmUgY29uc3RhbnRzIHNlcGFyYXRlOiBcXChcXHBpXFwpLCBcXChlXFwpLCBcXCgxL2VcXCksIFxcKFxcbG9nX3sxMH0yXFwpLCBhbmQgXFwoXFxsb2dfezEwfTNcXCkgZWFjaCBoYXZlIGEgZGlzdGluY3QgbnVtZXJpY2FsIHZhbHVlLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9XX0seyJpZCI6ImV1bGVyX3NwZWNpYWxfY2FzZXMiLCJsYWJlbCI6IkV1bGVyIGZvcm11bGEgYW5kIHNwZWNpYWwtYW5nbGUgaWRlbnRpdGllcyIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJoaWdoIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoyfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwMl9xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiVXNpbmcgRXVsZXIncyBmb3JtdWxhLCB3aGF0IGlzIFxcKGVee2pcXHBpLzJ9XFwpIGVxdWFsIHRvPyIsIm9wdGlvbnMiOlsiQS4gXFwoMVxcKSIsIkIuIFxcKC0xXFwpIiwiQy4gXFwoalxcKSIsIkQuIFxcKC1qXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiRnJvbSBcXChlXntqXFx0aGV0YX0gPSBcXGNvc1xcdGhldGEgKyBqXFxzaW5cXHRoZXRhXFwpLCBzdWJzdGl0dXRpbmcgXFwoXFx0aGV0YSA9IFxccGkvMlxcKSBnaXZlcyBcXChcXGNvcyhcXHBpLzIpICsgalxcc2luKFxccGkvMikgPSAwICsgaigxKSA9IGpcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiXFwoZV57alxcY2RvdCAwfSA9IDFcXCkuIFRoYXQgY29ycmVzcG9uZHMgdG8gYW5nbGUgXFwoMFxcKSwgbm90IFxcKFxccGkvMlxcKS4iLCJCIjoiXFwoZV57alxccGl9ID0gLTFcXCkuIFRoYXQgY29ycmVzcG9uZHMgdG8gYW5nbGUgXFwoXFxwaVxcKSBvbiB0aGUgbmVnYXRpdmUgcmVhbCBheGlzLiIsIkQiOiJcXChlXnstalxccGkvMn0gPSAtalxcKS4gVGhlIG5lZ2F0aXZlIHNpZ24gZmxpcHMgdGhlIGFuZ2xlIHRvIFxcKC1cXHBpLzJcXCkuIn0sImhpbnQiOiJBdCBcXChcXHRoZXRhID0gXFxwaS8yXFwpLCBjb3NpbmUgZXF1YWxzIFxcKDBcXCkgYW5kIHNpbmUgZXF1YWxzIFxcKDFcXCkuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AyX3EyIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJGb3IgaW50ZWdlciBcXChuXFwpLCB3aGljaCBzdGF0ZW1lbnQgbWF0Y2hlcyB0aGUgYXBwZW5kaXggaWRlbnRpdHkgZm9yIFxcKGVee1xccG0gam5cXHBpfVxcKT8iLCJvcHRpb25zIjpbIkEuIEl0IGlzIGFsd2F5cyBcXChqXFwpIiwiQi4gSXQgYWx0ZXJuYXRlcyBiZXR3ZWVuIFxcKDFcXCkgYW5kIFxcKC0xXFwpIGRlcGVuZGluZyBvbiB3aGV0aGVyIFxcKG5cXCkgaXMgZXZlbiBvciBvZGQiLCJDLiBJdCBpcyBhbHdheXMgXFwoLWpcXCkiLCJELiBJdCBhbHdheXMgZXF1YWxzIFxcKDBcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJBbmdsZXMgb2YgXFwoblxccGlcXCkgbGFuZCBvbiB0aGUgcmVhbCBheGlzLiBBdCBldmVuIFxcKG5cXCkgdGhlIGFuZ2xlIGlzIGEgbXVsdGlwbGUgb2YgXFwoMlxccGlcXCkgKHZhbHVlIFxcKCsxXFwpKTsgYXQgb2RkIFxcKG5cXCkgdGhlIGFuZ2xlIGlzIGFuIG9kZCBtdWx0aXBsZSBvZiBcXChcXHBpXFwpICh2YWx1ZSBcXCgtMVxcKSkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiXFwoalxcKSBvY2N1cnMgYXQgYW5nbGUgXFwoXFxwaS8yXFwpLCBub3QgYXQgaW50ZWdlciBtdWx0aXBsZXMgb2YgXFwoXFxwaVxcKS4iLCJDIjoiXFwoLWpcXCkgb2NjdXJzIGF0IGFuZ2xlIFxcKC1cXHBpLzJcXCksIG5vdCBhdCBpbnRlZ2VyIG11bHRpcGxlcyBvZiBcXChcXHBpXFwpLiIsIkQiOiJDb21wbGV4IGV4cG9uZW50aWFscyBsaWUgb24gdGhlIHVuaXQgY2lyY2xlIGFuZCBoYXZlIG1hZ25pdHVkZSBcXCgxXFwpOyB0aGV5IG5ldmVyIGVxdWFsIFxcKDBcXCkuIn0sImhpbnQiOiJUaGluayBhYm91dCB0aGUgcG9pbnRzIGF0IGFuZ2xlcyBcXCgwXFwpLCBcXChcXHBpXFwpLCBcXCgyXFxwaVxcKSwgYW5kIFxcKDNcXHBpXFwpIG9uIHRoZSB1bml0IGNpcmNsZSDigJQgdGhleSBhbGwgbGllIG9uIHRoZSByZWFsIGF4aXMuIiwibmVlZHNfdmlzdWFsIjp0cnVlLCJ2aXN1YWxfdHlwZSI6Im9wZW5haS9ncHQtNS40LWltYWdlLTIiLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6InJlY3Rhbmd1bGFyX3BvbGFyX2NvbnZlcnNpb24iLCJsYWJlbCI6IkludGVycHJldGluZyBcXChhICsgamIgPSByZV57alxcdGhldGF9XFwpIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AzX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJJbiB0aGUgZXhwcmVzc2lvbiBcXChhICsgamIgPSByZV57alxcdGhldGF9XFwpLCB3aGF0IGRvZXMgXFwoclxcKSByZXByZXNlbnQ/Iiwib3B0aW9ucyI6WyJBLiBUaGUgaW1hZ2luYXJ5LWF4aXMgY29vcmRpbmF0ZSBvbmx5IiwiQi4gVGhlIGFuZ2xlIGZyb20gdGhlIHJlYWwgYXhpcyIsIkMuIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBvcmlnaW4gdG8gdGhlIGNvbXBsZXggcG9pbnQiLCJELiBUaGUgY29lZmZpY2llbnQgb2YgXFwoalxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkMiLCJleHBsYW5hdGlvbiI6IlxcKHJcXCkgaXMgdGhlIG1hZ25pdHVkZSBvZiB0aGUgY29tcGxleCBudW1iZXIg4oCUIHRoZSBzdHJhaWdodC1saW5lIGRpc3RhbmNlIGZyb20gdGhlIG9yaWdpbiB0byB0aGUgcG9pbnQgXFwoKGEsIGIpXFwpIGluIHRoZSBjb21wbGV4IHBsYW5lLCBnaXZlbiBieSBcXChyID0gXFxzcXJ0e2FeMiArIGJeMn1cXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhlIGltYWdpbmFyeS1heGlzIGNvb3JkaW5hdGUgaXMgXFwoYlxcKSwgbm90IFxcKHJcXCkuIiwiQiI6IlRoZSBhbmdsZSBmcm9tIHRoZSByZWFsIGF4aXMgaXMgXFwoXFx0aGV0YVxcKSwgbm90IFxcKHJcXCkuIiwiRCI6IlRoZSBjb2VmZmljaWVudCBvZiBcXChqXFwpIGlzIFxcKGJcXCksIG5vdCBcXChyXFwpLiJ9LCJoaW50IjoiVGhpbmsgb2YgcG9sYXIgY29vcmRpbmF0ZXM6IFxcKHJcXCkgaXMgdGhlIHJhZGlhbCBkaXN0YW5jZSwgXFwoXFx0aGV0YVxcKSBpcyB0aGUgYW5nbGUuIiwibmVlZHNfdmlzdWFsIjp0cnVlLCJ2aXN1YWxfdHlwZSI6Im9wZW5haS9ncHQtNS40LWltYWdlLTIiLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9LHsiaWQiOiJrcDNfcTIiLCJ0eXBlIjoic2hvcnRfYW5zd2VyIiwic3RlbSI6IkZvciB0aGUgY29tcGxleCBudW1iZXIgXFwoMyArIDRqXFwpLCBzdGF0ZSBcXChyXFwpIGFuZCBkZXNjcmliZSBob3cgeW91IHdvdWxkIG9idGFpbiBcXChcXHRoZXRhXFwpIGZyb20gdGhlIGFwcGVuZGl4IGZvcm11bGEuIiwiaWRlYWxfYW5zd2VyIjoiXFwociA9IDVcXCkgYmVjYXVzZSBcXChyID0gXFxzcXJ0ezNeMiArIDReMn0gPSBcXHNxcnR7OSArIDE2fSA9IFxcc3FydHsyNX0gPSA1XFwpLiBUaGUgYW5nbGUgaXMgb2J0YWluZWQgZnJvbSBcXChcXHRoZXRhID0gXFx0YW5eey0xfSg0LzMpXFwpLCBtZWFzdXJlZCBmcm9tIHRoZSBwb3NpdGl2ZSByZWFsIGF4aXMuIiwiZ3JhZGluZ19ydWJyaWMiOlsiTXVzdCBzdGF0ZSBcXChyID0gNVxcKSIsIk11c3QgdXNlIG9yIHJlZmVyZW5jZSBcXChyID0gXFxzcXJ0e2FeMiArIGJeMn1cXCkgd2l0aCBcXChhID0gM1xcKSwgXFwoYiA9IDRcXCkiLCJNdXN0IHN0YXRlIHRoYXQgXFwoXFx0aGV0YVxcKSBjb21lcyBmcm9tIFxcKFxcdGFuXnstMX0oYi9hKSA9IFxcdGFuXnstMX0oNC8zKVxcKSIsIk11c3QgZGVzY3JpYmUgXFwoXFx0aGV0YVxcKSBhcyBhbiBhbmdsZSBtZWFzdXJlZCBmcm9tIHRoZSBwb3NpdGl2ZSByZWFsIGF4aXMiXSwiZXhwbGFuYXRpb24iOiJUaGlzIGNoZWNrcyB3aGV0aGVyIHRoZSBzdHVkZW50IGNhbiBhcHBseSB0aGUgY29udmVyc2lvbiBmb3JtdWxhIGFzIGEgY2FsY3VsYXRpb24gcnVsZSwgbm90IGp1c3QgcmVjb2duaXplIHRoZSBzeW1ib2xzLiIsImhpbnQiOiJTdWJzdGl0dXRlIFxcKGEgPSAzXFwpIGFuZCBcXChiID0gNFxcKSBkaXJlY3RseSBpbnRvIFxcKHIgPSBcXHNxcnR7YV4yICsgYl4yfVxcKSBhbmQgXFwoXFx0aGV0YSA9IFxcdGFuXnstMX0oYi9hKVxcKS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19LHsiaWQiOiJwb2xhcl9tdWx0aXBsaWNhdGlvbl9ydWxlIiwibGFiZWwiOiJPcGVyYXRpb25zIGluIGV4cG9uZW50aWFsIGZvcm0iLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDRfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoYXQgaXMgXFwoKDJlXntqMzBeXFxjaXJjfSkoM2Vee2oyMF5cXGNpcmN9KVxcKT8iLCJvcHRpb25zIjpbIkEuIFxcKDVlXntqNTBeXFxjaXJjfVxcKSIsIkIuIFxcKDZlXntqMTBeXFxjaXJjfVxcKSIsIkMuIFxcKDZlXntqNTBeXFxjaXJjfVxcKSIsIkQuIFxcKDVlXntqMTBeXFxjaXJjfVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkMiLCJleHBsYW5hdGlvbiI6IldoZW4gbXVsdGlwbHlpbmcgaW4gZXhwb25lbnRpYWwgZm9ybSwgbWFnbml0dWRlcyBtdWx0aXBseSBhbmQgYW5nbGVzIGFkZDogXFwoMiBcXHRpbWVzIDMgPSA2XFwpIGFuZCBcXCgzMF5cXGNpcmMgKyAyMF5cXGNpcmMgPSA1MF5cXGNpcmNcXCksIGdpdmluZyBcXCg2ZV57ajUwXlxcY2lyY31cXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhlIG1hZ25pdHVkZXMgXFwoMlxcKSBhbmQgXFwoM1xcKSBtdXN0IG11bHRpcGx5IChnaXZpbmcgXFwoNlxcKSksIG5vdCBhZGQgKGdpdmluZyBcXCg1XFwpKS4iLCJCIjoiVGhlIGFuZ2xlcyBtdXN0IGFkZCB0byBcXCg1MF5cXGNpcmNcXCksIG5vdCBzdWJ0cmFjdCB0byBcXCgxMF5cXGNpcmNcXCkuIiwiRCI6IkJvdGggZXJyb3JzIGFwcGVhciB0b2dldGhlcjogbWFnbml0dWRlcyB3ZXJlIGFkZGVkIGluc3RlYWQgb2YgbXVsdGlwbGllZCwgYW5kIGFuZ2xlcyB3ZXJlIHN1YnRyYWN0ZWQgaW5zdGVhZCBvZiBhZGRlZC4ifSwiaGludCI6Ik11bHRpcGx5IHRoZSBmcm9udCBudW1iZXJzOyBhZGQgdGhlIGV4cG9uZW50IGFuZ2xlcy4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19XX0=" style="display:none;"></div>%%KC_END%%
