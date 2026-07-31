%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImdlbmVyYXRlZF9pbWFnZSIsInJhdGlvbmFsZSI6IlRoaXMgYXBwZW5kaXggc3Vic2VjdGlvbiBpcyBmb3JtdWxhLWRlbnNlIGFuZCBoYXMgbm8gZXh0cmFjdGVkIHRleHRib29rIGZpZ3VyZXMgYXZhaWxhYmxlLiBBIGNsZWFuIGdlbmVyYXRlZCB0ZWFjaGluZyB2aXN1YWwgaXMgdGhlIGJlc3Qgd2F5IHRvIG1ha2UgdGhlIHJlY3Rhbmd1bGFyLXRvLXBvbGFyIHJlbGF0aW9uc2hpcCBpbW1lZGlhdGVseSB2aXNpYmxlIHdoaWxlIGtlZXBpbmcgdGhlIGxlc3NvbiBhbmNob3JlZCB0byB0aGUgZXhhY3QgZm9ybXVsYXMgc2hvd24gaW4gdGhlIE9DUi4iLCJjcmFtIjoiVXNlIG9uZSBjbGVhbiBjb21wbGV4LXBsYW5lIGRpYWdyYW0gc28gc3R1ZGVudHMgY2FuIHF1aWNrbHkgbWF0Y2ggYSArIGpiLCByLCBhbmQgXFx0aGV0YSBvbiBleGFtcy4iLCJzdGFuZGFyZCI6IlVzZSB0aGUgdmlzdWFsIHRvIGV4cGxhaW4gdGhlIGNvcmUgY29udmVyc2lvbiBpZGVhLCB0aGVuIHN1cHBvcnQgaXQgd2l0aCBvbmUgcmVwcmVzZW50YXRpdmUgZXhhbXBsZSBhbmQgdGhlIG1haW4gb3BlcmF0aW9uIHJ1bGVzLiIsInRvcF9zY29yZSI6IlVzZSB0aGUgdmlzdWFsIHRvIGVtcGhhc2l6ZSBhbmdsZSBpbnRlcnByZXRhdGlvbiwgcXVhZHJhbnQgYXdhcmVuZXNzLCBhbmQgd2h5IG11bHRpcGxpY2F0aW9uIGFkZHMgYW5nbGVzIHdoaWxlIHBvd2VycyBtdWx0aXBseSBhbmdsZXMuIn0=" style="display:none;"></div>%%KC_END%%
# B.8-2 Complex Numbers: Exponential and Polar Form

> **Objective:** Build a compact, exam-ready reference for the most useful complex-number formulas — not a full theory chapter, just the tools you will reach for repeatedly.

This page covers four things: Euler's formula \(e^{j\theta} = \cos\theta + j\sin\theta\), rectangular form \(a + jb\), polar/exponential form \(re^{j\theta}\), and the shortcut rules for multiplication and powers.

Why does this matter? In signals and systems work, these formulas replace messy algebra with clean magnitude-and-angle steps — a major speed advantage on exams. One reminder before we start: \(j\) marks the **vertical** component on the complex plane, the imaginary axis. Keep that picture in mind throughout.

## 1. Rectangular Form and Polar Form

The expression \(a + jb\) describes a complex number by its **horizontal** component \(a\) (real part) and **vertical** component \(b\) (imaginary part). The expression \(re^{j\theta}\) describes the **same** number by its length \(r\) from the origin and its angle \(\theta\) from the positive real axis. Both forms point to the same location on the complex plane — they are just two different languages for the same point.

The conversion formulas are:

$$r = \sqrt{a^2 + b^2}, \qquad \theta = \tan^{-1}\!\left(\frac{b}{a}\right)$$

#### Warning
The formula \(\theta = \tan^{-1}(b/a)\) gives the correct angle only when the point is in the first or fourth quadrant. For points in the second or third quadrant, add or subtract \(\pi\) to land in the right quadrant.

### WORKED EXAMPLE

Convert \(z = 1 + j\) to exponential form.

- Magnitude: \(r = \sqrt{1^2 + 1^2} = \sqrt{2}\)
- Angle: \(\theta = \tan^{-1}(1/1) = \pi/4\)
- Result: \(z = \sqrt{2}\,e^{j\pi/4}\)

### EXAM TIP

Whenever a question asks for **magnitude and phase**, switch to polar form immediately — it is almost always faster than staying in rectangular form.

$$e^{\pm j\theta} = \cos\theta \pm j\sin\theta$$
*Euler's formula links the complex exponential to cosine-and-sine coordinates on the complex plane, which is precisely why polar form works: the real part traces \(\cos\theta\) and the imaginary part traces \(\sin\theta\) as \(\theta\) varies.*

## 2. Fast Rules in Exponential Form

Exponential form makes two operations almost effortless.

**Powers** — raise the magnitude to the power and multiply the angle:

$$\left(re^{j\theta}\right)^k = r^k e^{jk\theta}$$

**Multiplication** — multiply the magnitudes and add the angles:

$$\left(r_1 e^{j\theta_1}\right)\!\left(r_2 e^{j\theta_2}\right) = r_1 r_2\, e^{j(\theta_1 + \theta_2)}$$

In plain language: **powers scale the magnitude and stretch the angle; multiplication scales both magnitudes and rotates by the combined angle.**

### QUICK REFERENCE IDENTITIES

Two special values worth memorizing:

$$e^{\pm j\pi/2} = \pm j, \qquad e^{\pm jn\pi} = \begin{cases} +1 & n \text{ even} \\ -1 & n \text{ odd} \end{cases}$$

### WORKED EXAMPLE

Compute \((2e^{j\pi/3})(3e^{j\pi/6})\):

- Magnitudes: \(2 \times 3 = 6\)
- Angles: \(\pi/3 + \pi/6 = 2\pi/6 + \pi/6 = \pi/2\)
- Result: \(6e^{j\pi/2} = 6j\)

#### Check
Notice that the final angle is exactly \(\pi/2\), which is why the result collapses to the pure imaginary number \(6j\). Whenever the angle lands on a reference value, use the quick identities above to simplify immediately.

$$a + jb = r e^{j\theta}, \quad r = \sqrt{a^2 + b^2}, \quad \theta = \tan^{-1}\!\left(\frac{b}{a}\right)$$
*This formula package converts a complex number from component form \(a + jb\) into magnitude-and-angle form \(re^{j\theta}\), giving you the same point expressed in whichever representation the problem requires.*

---
**📌 Key Takeaways**
- Euler's formula \(e^{j\theta} = \cos\theta + j\sin\theta\) links exponentials to the complex plane directly.
- Convert \(a + jb\) to polar form using \(r = \sqrt{a^2 + b^2}\) and \(\theta = \tan^{-1}(b/a)\); watch the quadrant.
- Multiplication adds angles and multiplies magnitudes; powers multiply the angle and raise the magnitude.

*In the next section we will use reference formulas like these to move faster through larger derivations.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6ImV1bGVyX2lkZW50aXR5IiwibGFiZWwiOiJSZWNvZ25pemluZyBFdWxlci1mb3JtIGlkZW50aXRpZXMiLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6Mn0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDFfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGV4cHJlc3Npb24gaXMgZXF1YWwgdG8gXFwoZV57alxcdGhldGF9XFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoXFxjb3NcXHRoZXRhIC0galxcc2luXFx0aGV0YVxcKSIsIkIuIFxcKFxcY29zXFx0aGV0YSArIGpcXHNpblxcdGhldGFcXCkiLCJDLiBcXChcXHNpblxcdGhldGEgKyBqXFxjb3NcXHRoZXRhXFwpIiwiRC4gXFwoXFxjb3NcXHRoZXRhICsgXFxzaW5cXHRoZXRhXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQiIsImV4cGxhbmF0aW9uIjoiRXVsZXIncyBmb3JtdWxhIGdpdmVzIFxcKGVee2pcXHRoZXRhfSA9IFxcY29zXFx0aGV0YSArIGpcXHNpblxcdGhldGFcXCkuIFRoZSByZWFsIHBhcnQgaXMgY29zaW5lIGFuZCB0aGUgaW1hZ2luYXJ5IHBhcnQgaXMgc2luZS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGUgbWludXMgc2lnbiBjb3JyZXNwb25kcyB0byBcXChlXnstalxcdGhldGF9XFwpLCBub3QgXFwoZV57alxcdGhldGF9XFwpLiIsIkMiOiJDb3NpbmUgaXMgdGhlIHJlYWwtYXhpcyBwYXJ0IGFuZCBzaW5lIGlzIHRoZSBpbWFnaW5hcnktYXhpcyBwYXJ0LCBub3QgdGhlIG90aGVyIHdheSBhcm91bmQuIiwiRCI6IlRoaXMgb21pdHMgXFwoalxcKSwgc28gaXQgaXMgbm90IGEgY29tcGxleCBleHBvbmVudGlhbCBpZGVudGl0eSDigJQgaXQgaXMganVzdCBhIHJlYWwgbnVtYmVyLiJ9LCJoaW50IjoiTWF0Y2ggdGhlIHJlYWwgYXhpcyB3aXRoIGNvc2luZSBhbmQgdGhlIGltYWdpbmFyeSBheGlzIHdpdGggc2luZS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfSx7ImlkIjoia3AxX3EyIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGF0IGlzIFxcKGVee2pcXHBpLzJ9XFwpIGVxdWFsIHRvPyIsIm9wdGlvbnMiOlsiQS4gXFwoMVxcKSIsIkIuIFxcKC0xXFwpIiwiQy4gXFwoalxcKSIsIkQuIFxcKC1qXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiQXQgYW5nbGUgXFwoXFxwaS8yXFwpLCB0aGUgY29tcGxleCBleHBvbmVudGlhbCBwb2ludHMgc3RyYWlnaHQgdXAgYWxvbmcgdGhlIHBvc2l0aXZlIGltYWdpbmFyeSBheGlzLCBzbyBcXChlXntqXFxwaS8yfSA9IFxcY29zKFxccGkvMikgKyBqXFxzaW4oXFxwaS8yKSA9IDAgKyBqKDEpID0galxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJcXCgxXFwpIGNvcnJlc3BvbmRzIHRvIGFuZ2xlIFxcKDBcXCksIG5vdCBcXChcXHBpLzJcXCkuIiwiQiI6IlxcKC0xXFwpIGNvcnJlc3BvbmRzIHRvIGFuZ2xlIFxcKFxccGlcXCksIG5vdCBcXChcXHBpLzJcXCkuIiwiRCI6IlxcKC1qXFwpIGNvcnJlc3BvbmRzIHRvIGFuZ2xlIFxcKC1cXHBpLzJcXCksIG5vdCBcXCgrXFxwaS8yXFwpLiJ9LCJoaW50IjoiUGljdHVyZSBhIHVuaXQtcmFkaXVzIHBvaW50IHJvdGF0aW5nIHRvIHRoZSBwb3NpdGl2ZSBpbWFnaW5hcnkgYXhpcyDigJQgdGhhdCBpcyBzdHJhaWdodCB1cC4iLCJuZWVkc192aXN1YWwiOnRydWUsInZpc3VhbF90eXBlIjoiZ2VuZXJhdGVfaW1hZ2UiLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6InJlY3Rhbmd1bGFyX3BvbGFyX2NvbnZlcnNpb24iLCJsYWJlbCI6IkNvbnZlcnRpbmcgYmV0d2VlbiByZWN0YW5ndWxhciBhbmQgcG9sYXIgZm9ybSIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJoaWdoIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoyfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwMl9xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiRm9yIFxcKHogPSAzICsgNGpcXCksIHdoYXQgaXMgdGhlIG1hZ25pdHVkZSBcXChyXFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoNVxcKSIsIkIuIFxcKDdcXCkiLCJDLiBcXChcXHNxcnR7N31cXCkiLCJELiBcXChcXHRhbl57LTF9KDQvMylcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJBIiwiZXhwbGFuYXRpb24iOiJUaGUgbWFnbml0dWRlIGlzIFxcKHIgPSBcXHNxcnR7M14yICsgNF4yfSA9IFxcc3FydHs5ICsgMTZ9ID0gXFxzcXJ0ezI1fSA9IDVcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJCIjoiVGhpcyBpbmNvcnJlY3RseSBhZGRzIHRoZSBjb21wb25lbnRzIGRpcmVjdGx5IChcXCgzICsgNCA9IDdcXCkpIGluc3RlYWQgb2YgdXNpbmcgdGhlIFB5dGhhZ29yZWFuIGZvcm11bGEuIiwiQyI6IlRoaXMgd291bGQgY29tZSBmcm9tIFxcKFxcc3FydHszICsgNH1cXCksIHdoaWNoIGlzIG5vdCB0aGUgY29ycmVjdCBmb3JtdWxhLiIsIkQiOiJUaGlzIGlzIHRoZSBhbmdsZSBcXChcXHRoZXRhXFwpLCBub3QgdGhlIG1hZ25pdHVkZSBcXChyXFwpLiJ9LCJoaW50IjoiTWFnbml0dWRlIGNvbWVzIGZyb20gYSByaWdodCB0cmlhbmdsZTogXFwociA9IFxcc3FydHthXjIgKyBiXjJ9XFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9LHsiaWQiOiJrcDJfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGV4cG9uZW50aWFsIGZvcm0gbWF0Y2hlcyBcXCh6ID0gMSArIGpcXCk/Iiwib3B0aW9ucyI6WyJBLiBcXChlXntqXFxwaS8yfVxcKSIsIkIuIFxcKFxcc3FydHsyfVxcLGVee2pcXHBpLzR9XFwpIiwiQy4gXFwoMmVee2pcXHBpLzR9XFwpIiwiRC4gXFwoXFxzcXJ0ezJ9XFwsZV57LWpcXHBpLzR9XFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQiIsImV4cGxhbmF0aW9uIjoiRm9yIFxcKDEgKyBqXFwpOiBtYWduaXR1ZGUgXFwociA9IFxcc3FydHsxXjIgKyAxXjJ9ID0gXFxzcXJ0ezJ9XFwpIGFuZCBhbmdsZSBcXChcXHRoZXRhID0gXFx0YW5eey0xfSgxLzEpID0gXFxwaS80XFwpLCBzbyBcXCh6ID0gXFxzcXJ0ezJ9XFwsZV57alxccGkvNH1cXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiXFwoZV57alxccGkvMn0gPSBqXFwpLCB3aGljaCBpcyBub3QgdGhlIHNhbWUgYXMgXFwoMSArIGpcXCkuIiwiQyI6IlRoZSBhbmdsZSBcXChcXHBpLzRcXCkgaXMgY29ycmVjdCwgYnV0IHRoZSBtYWduaXR1ZGUgc2hvdWxkIGJlIFxcKFxcc3FydHsyfVxcKSwgbm90IFxcKDJcXCkuIiwiRCI6IlRoZSBtYWduaXR1ZGUgXFwoXFxzcXJ0ezJ9XFwpIGlzIGNvcnJlY3QsIGJ1dCB0aGUgYW5nbGUgc2hvdWxkIGJlIHBvc2l0aXZlIFxcKFxccGkvNFxcKSBiZWNhdXNlIHRoZSBwb2ludCBpcyBpbiB0aGUgZmlyc3QgcXVhZHJhbnQuIn0sImhpbnQiOiJDb21wdXRlIGJvdGggbWFnbml0dWRlIGFuZCBhbmdsZSwgYW5kIGNoZWNrIHdoaWNoIHF1YWRyYW50IHRoZSBwb2ludCBpcyBpbi4iLCJuZWVkc192aXN1YWwiOnRydWUsInZpc3VhbF90eXBlIjoiZ2VuZXJhdGVfaW1hZ2UiLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6Im9wZXJhdGlvbnNfaW5fZXhwb25lbnRpYWxfZm9ybSIsImxhYmVsIjoiTXVsdGlwbGljYXRpb24gYW5kIHBvd2VycyBpbiBleHBvbmVudGlhbCBmb3JtIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjF9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AzX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGF0IGlzIFxcKCgyZV57alxccGkvM30pKDNlXntqXFxwaS82fSlcXCk/Iiwib3B0aW9ucyI6WyJBLiBcXCg1ZV57alxccGkvMn1cXCkiLCJCLiBcXCg2ZV57alxccGkvMTh9XFwpIiwiQy4gXFwoNmVee2pcXHBpLzJ9XFwpIiwiRC4gXFwoNmVee2pcXHBpLzN9XFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiTXVsdGlwbHkgbWFnbml0dWRlczogXFwoMiBcXHRpbWVzIDMgPSA2XFwpLiBBZGQgYW5nbGVzOiBcXChcXHBpLzMgKyBcXHBpLzYgPSAyXFxwaS82ICsgXFxwaS82ID0gXFxwaS8yXFwpLiBSZXN1bHQ6IFxcKDZlXntqXFxwaS8yfVxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJNYWduaXR1ZGVzIG11bHRpcGx5LCB0aGV5IGRvIG5vdCBhZGQ6IFxcKDIgKyAzID0gNVxcKSBpcyB3cm9uZy4iLCJCIjoiQW5nbGVzIGFkZCwgdGhleSBhcmUgbm90IG11bHRpcGxpZWQgb3IgZGl2aWRlZDogXFwoXFxwaS8zIFxcdGltZXMgXFxwaS82XFwpIGlzIG5vdCB0aGUgcnVsZS4iLCJEIjoiVGhpcyBrZWVwcyBvbmx5IHRoZSBmaXJzdCBhbmdsZSBhbmQgaWdub3JlcyB0aGUgc2Vjb25kIGFuZ2xlIGVudGlyZWx5LiJ9LCJoaW50IjoiUmVtZW1iZXIgdGhlIHJ1bGU6IG11bHRpcGx5IFxcKHJcXCksIGFkZCBcXChcXHRoZXRhXFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9LHsiaWQiOiJrcDNfcTIiLCJ0eXBlIjoic2hvcnRfYW5zd2VyIiwic3RlbSI6IlNpbXBsaWZ5IFxcKCgyZV57alxccGkvNH0pXjJcXCkgYW5kIHN0YXRlIHRoZSByZXN1bHQgaW4gZXhwb25lbnRpYWwgZm9ybS4iLCJpZGVhbF9hbnN3ZXIiOiJcXCgoMmVee2pcXHBpLzR9KV4yID0gMl4yXFwsZV57aigyIFxcY2RvdCBcXHBpLzQpfSA9IDRlXntqXFxwaS8yfVxcKS4iLCJncmFkaW5nX3J1YnJpYyI6WyJNdXN0IHNxdWFyZSB0aGUgbWFnbml0dWRlIHRvIGdldCBcXCg0XFwpIiwiTXVzdCBkb3VibGUgdGhlIGFuZ2xlIGZyb20gXFwoXFxwaS80XFwpIHRvIFxcKFxccGkvMlxcKSIsIk11c3QgcHJlc2VudCB0aGUgZmluYWwgYW5zd2VyIGFzIFxcKDRlXntqXFxwaS8yfVxcKSJdLCJleHBsYW5hdGlvbiI6IlRoaXMgY2hlY2tzIHdoZXRoZXIgdGhlIHN0dWRlbnQga25vd3MgdGhhdCBwb3dlcnMgYWN0IG9uIGJvdGggdGhlIG1hZ25pdHVkZSBhbmQgdGhlIGFuZ2xlOiBcXCgocmVee2pcXHRoZXRhfSleayA9IHJeayBlXntqa1xcdGhldGF9XFwpLiIsImhpbnQiOiJVc2UgdGhlIHBvd2VyIHJ1bGUgXFwoKHJlXntqXFx0aGV0YX0pXmsgPSByXmsgZV57amtcXHRoZXRhfVxcKSB3aXRoIFxcKGsgPSAyXFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfV19" style="display:none;"></div>%%KC_END%%
