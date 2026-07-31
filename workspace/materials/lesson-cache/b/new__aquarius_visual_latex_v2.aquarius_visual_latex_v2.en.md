%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImJvdGgiLCJyYXRpb25hbGUiOiJUaGlzIHNlY3Rpb24gaXMgc3Ryb25nbHkgdmlzdWFsIGJlY2F1c2UgdGhlIGNvcmUgaWRlYXMgYXJlIGdlb21ldHJpYzogcG9pbnQgbG9jYXRpb24sIG1hZ25pdHVkZSwgYW5nbGUsIGNvbmp1Z2F0ZSByZWZsZWN0aW9uLCBhbmQgcXVhZHJhbnQtYXdhcmUgY29udmVyc2lvbi4gVGhlIHRleHRib29rIGFscmVhZHkgcHJvdmlkZXMgaGlnaC12YWx1ZSBBcmdhbmQtcGxhbmUgZmlndXJlcywgYW5kIGEgY2xlYW4gZ2VuZXJhdGVkIGRpYWdyYW0gY2FuIHNpbXBsaWZ5IHRoZSByZWN0YW5ndWxhci12ZXJzdXMtcG9sYXIgcmVsYXRpb25zaGlwIGludG8gb25lIGxlY3R1cmUtbm90ZSB2aXN1YWwuIiwiY3JhbSI6IlVzZSB2aXN1YWxzIHRvIGhlbHAgdGhlIHN0dWRlbnQgaW5zdGFudGx5IGlkZW50aWZ5IHF1YWRyYW50LCBtYWduaXR1ZGUtYW5nbGUgcmVhZGluZywgYW5kIHdoaWNoIGZvcm0gaXMgZmFzdGVyIGZvciBlYWNoIG9wZXJhdGlvbi4iLCJzdGFuZGFyZCI6IlVzZSB0aGUgYm9vayBmaWd1cmVzIHRvIGV4cGxhaW4gdGhlIGNvcmUgZ2VvbWV0cnksIHRoZW4gb25lIGNsZWFuIGdlbmVyYXRlZCBkaWFncmFtIHRvIGNvbm5lY3QgZm9ybXVsYXMgYW5kIG9uZSByZXByZXNlbnRhdGl2ZSBleGFtcGxlLiIsInRvcF9zY29yZSI6IlVzZSB2aXN1YWxzIHRvIGV4cG9zZSBwcmluY2lwYWwtYW5nbGUgY2hvaWNlcywgY2FsY3VsYXRvciBxdWFkcmFudCB0cmFwcywgYW5kIHdoeSBjb25qdWdhdGVzIHJlZmxlY3QgYWNyb3NzIHRoZSByZWFsIGF4aXMuIn0=" style="display:none;"></div>%%KC_END%%
# Complex Numbers — Forms, Conversion, and Arithmetic

> **Section Objective:** Master the two forms of complex numbers, convert between them correctly, and choose the right form for each arithmetic operation.

Complex numbers are not an abstract curiosity — engineers use them constantly in signals and systems to represent magnitude and phase together in one compact object. One practical note: engineers write \(j\) instead of \(i\) to avoid confusion with current.

In this section you will learn four things: how to read a complex number in **rectangular form** \(a + jb\), how to write it in **polar/exponential form** \(re^{j\theta}\), how to work with **conjugates**, and when each form makes arithmetic easier.

> **Exam warning:** Most angle mistakes come from choosing the wrong quadrant. Keep that in mind throughout.

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="book_image" data-teaching-role="concept_anchor" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoaXMgZmlndXJlIHRvIGxvY2sgaW4gcG9pbnQsIG1hZ25pdHVkZSwgYW5nbGUsIGFuZCBjb25qdWdhdGUgaW4gb25lIGdsYW5jZS4iLCJzdGFuZGFyZCI6IlVzZSB0aGlzIGZpZ3VyZSB0byBleHBsYWluIGhvdyBhICsgamIgbWFwcyB0byBjb29yZGluYXRlcyBhbmQgaG93IHIgYW5kIHRoZXRhIGFyZSByZWFkLiIsInRvcF9zY29yZSI6IlVzZSB0aGlzIGZpZ3VyZSB0byBzdHJlc3MgY29uanVnYXRlIHJlZmxlY3Rpb24gYW5kIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGVybSwgcGFydCwgbWFnbml0dWRlLCBhbmQgYW5nbGUuIn0=" style="display:none;"></div>%%KC_END%%
![Fig. B.2](/figures/page-005-fig__b_2-1.png)
*The same complex number \(z = a + jb\) can be read as coordinates \((a, b)\) on the plane or as magnitude-angle data \((r, \theta)\), and its conjugate \(z^* = a - jb\) is simply the mirror image reflected across the real axis.*

## 1. Reading a Complex Number on the Complex Plane

A complex number \(z = a + jb\) is a point on the complex plane. The horizontal coordinate is \(a\) and the vertical coordinate is \(b\).

- **The real part** is \(a\): written \(\text{Re}(z) = a\).
- **The imaginary part** is \(b\): written \(\text{Im}(z) = b\).

#### Important
The imaginary part is the **coefficient** \(b\), not the term \(jb\). Writing \(\text{Im}(z) = bj\) is a common error.

The **conjugate** \(z^* = a - jb\) flips only the sign of the imaginary component, so it is the mirror image of \(z\) across the real axis.

### WORKED EXAMPLE

For \(z = 3 + 4j\):
- \(\text{Re}(z) = 3\)
- \(\text{Im}(z) = 4\) (not \(4j\))
- \(|z| = \sqrt{3^2 + 4^2} = \sqrt{25} = 5\)
- \(z^* = 3 - 4j\) — located at \((3, -4)\), directly below \(z\)

### EXAM TIP

Students often write \(\text{Im}(z) = 4j\) instead of \(4\). The imaginary **part** is a real number; \(4j\) is the imaginary **term**.

$$z = a + jb = r(\cos\theta + j\sin\theta) = re^{j\theta}$$
*This single formula shows three equivalent descriptions of the same complex number: rectangular form \(a + jb\) gives the horizontal and vertical coordinates directly; trigonometric polar form \(r(\cos\theta + j\sin\theta)\) expresses those coordinates through a distance and an angle; and exponential polar form \(re^{j\theta}\) is the most compact version of the same idea. Here \(r\) is the distance from the origin to the point, and \(\theta\) is the angle measured counterclockwise from the positive real axis.*

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="book_image" data-teaching-role="trap_exposure" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoaXMgZmlndXJlIHRvIHRyYWluIGZhc3QgcXVhZHJhbnQgcmVjb2duaXRpb24gYmVmb3JlIHByZXNzaW5nIGludmVyc2UgdGFuZ2VudCBvbiBhIGNhbGN1bGF0b3IuIiwic3RhbmRhcmQiOiJVc2UgdGhpcyBmaWd1cmUgdG8gZXhwbGFpbiB3aHkgdGhlIHNhbWUgbWFnbml0dWRlIGZvcm11bGEgd29ya3MgZXZlcnl3aGVyZSBidXQgYW5nbGUgc2VsZWN0aW9uIGNoYW5nZXMgYnkgcXVhZHJhbnQuIiwidG9wX3Njb3JlIjoiVXNlIHRoaXMgZmlndXJlIHRvIGNvbXBhcmUgZmlyc3QtLCBzZWNvbmQtLCB0aGlyZC0sIGFuZCBmb3VydGgtcXVhZHJhbnQgYW5nbGUgY2hvaWNlcyBhbmQgcHJpbmNpcGFsIHZhbHVlcy4ifQ==" style="display:none;"></div>%%KC_END%%
![unknown](/figures/page-009-unknown-1.png)
*Rectangular-to-polar conversion always gives the same magnitude formula \(r = \sqrt{a^2 + b^2}\), but the angle \(\theta\) must be selected from the correct quadrant based on the signs of \(a\) and \(b\).*

## 2. Converting Between Rectangular and Polar Form

Follow these three steps every time:

1. **Compute the magnitude:** \(r = \sqrt{a^2 + b^2}\)
2. **Identify the quadrant** from the signs of \(a\) and \(b\)
3. **Choose \(\theta\)** so it lands in that quadrant

### WORKED EXAMPLE — Rectangular to Polar

Convert \(z = -2 - 3j\).

- Magnitude: \(r = \sqrt{(-2)^2 + (-3)^2} = \sqrt{4 + 9} = \sqrt{13}\)
- Both \(a < 0\) and \(b < 0\), so the point is in **quadrant III**
- Raw calculator result: \(\tan^{-1}\!\left(\frac{-3}{-2}\right) = \tan^{-1}(1.5) \approx 56.3^\circ\) — this is a quadrant I angle, which is **wrong**
- Quadrant III correction: \(56.3^\circ - 180^\circ = -123.7^\circ\) (principal angle)
- Result: \(z = \sqrt{13}\,e^{j(-123.7^\circ)}\)

### WORKED EXAMPLE — Polar to Rectangular

Convert \(2e^{j\pi/3}\).

$$z = 2\left(\cos\frac{\pi}{3} + j\sin\frac{\pi}{3}\right) = 2\left(\frac{1}{2} + j\frac{\sqrt{3}}{2}\right) = 1 + j\sqrt{3}$$

### EXAM TIP

Never trust \(\tan^{-1}(b/a)\) blindly when the point is in quadrant II or III — the calculator always returns a value between \(-90^\circ\) and \(90^\circ\), which is wrong for those quadrants.

## 3. Choosing the Best Form for Arithmetic

The rule of thumb is simple:

| Operation | Best Form |
|---|---|
| Addition, Subtraction | Rectangular \(a + jb\) |
| Multiplication, Division, Powers, Roots | Polar \(re^{j\theta}\) |

### WORKED EXAMPLE

Let \(z_1 = 3 + 4j\) and \(z_2 = 2 + 3j\).

**Addition** is easy in rectangular form:
$$z_1 + z_2 = (3+2) + j(4+3) = 5 + 7j$$

**Multiplication** is easier in polar form. In polar, \(|z_1| = 5\) at \(\theta_1 = 53.1^\circ\) and \(|z_2| = \sqrt{13}\) at \(\theta_2 = 56.3^\circ\), so:
$$z_1 z_2 = 5\sqrt{13}\,e^{j(53.1^\circ + 56.3^\circ)} = 5\sqrt{13}\,e^{j109.4^\circ}$$

Magnitudes **multiply**, angles **add** — no messy cross-terms.

For division, magnitudes **divide** and angles **subtract**.

### QUICK CHECK

If you see multiplication of two numbers already written as \(re^{j\theta}\), should you convert to rectangular first?

---
**📌 Key Takeaways**
- A complex number has two equivalent forms: rectangular \(a + jb\) and polar \(re^{j\theta}\) — same point, two descriptions.
- Magnitude uses \(r = \sqrt{a^2+b^2}\) everywhere, but angle \(\theta\) must be chosen from the correct quadrant.
- Use rectangular form for addition and subtraction; use polar form for multiplication, division, powers, and roots.

*In the next section we will use these ideas to describe sinusoids and phasors more naturally.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NywicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo2LCJtYXgiOjh9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InJlY3Rhbmd1bGFyX3BhcnRzX2FuZF9jb25qdWdhdGUiLCJsYWJlbCI6IlJlYWwgcGFydCwgaW1hZ2luYXJ5IHBhcnQsIGFuZCBjb25qdWdhdGUiLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6Mn0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDFfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IkZvciBcXCh6ID0gNSAtIDJqXFwpLCB3aGljaCBzdGF0ZW1lbnQgaXMgY29ycmVjdD8iLCJvcHRpb25zIjpbIkEuIFxcKFxcdGV4dHtSZX0oeikgPSAtMlxcKSIsIkIuIFxcKFxcdGV4dHtJbX0oeikgPSAtMmpcXCkiLCJDLiBcXChcXHRleHR7SW19KHopID0gLTJcXCkiLCJELiBcXCh6XiogPSA1IC0gMmpcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJDIiwiZXhwbGFuYXRpb24iOiJUaGUgaW1hZ2luYXJ5IHBhcnQgaXMgdGhlIHJlYWwgY29lZmZpY2llbnQgb2YgXFwoalxcKSwgc28gXFwoXFx0ZXh0e0ltfSh6KSA9IC0yXFwpLiBUaGUgY29uanVnYXRlIGNoYW5nZXMgdGhlIHNpZ24gb2YgdGhlIFxcKGpcXCktdGVybSwgZ2l2aW5nIFxcKHpeKiA9IDUgKyAyalxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGUgcmVhbCBwYXJ0IGlzIFxcKDVcXCksIG5vdCBcXCgtMlxcKS4iLCJCIjoiXFwoLTJqXFwpIGlzIHRoZSBpbWFnaW5hcnkgdGVybSBpbiB0aGUgZXhwcmVzc2lvbiwgbm90IHRoZSBpbWFnaW5hcnkgcGFydCBpdHNlbGYg4oCUIHRoZSBpbWFnaW5hcnkgcGFydCBpcyB0aGUgY29lZmZpY2llbnQgXFwoLTJcXCkuIiwiRCI6IlRoZSBjb25qdWdhdGUgb2YgXFwoNSAtIDJqXFwpIGlzIFxcKDUgKyAyalxcKSwgbm90IHRoZSBzYW1lIG51bWJlci4ifSwiaGludCI6IlNlcGFyYXRlIHRoZSBjb2VmZmljaWVudCBmcm9tIHRoZSBzeW1ib2wgXFwoalxcKS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9LHsiaWQiOiJrcDFfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IklmIFxcKHogPSAzICsgNGpcXCksIHdoZXJlIGlzIGl0cyBjb25qdWdhdGUgXFwoel4qXFwpIG9uIHRoZSBjb21wbGV4IHBsYW5lPyIsIm9wdGlvbnMiOlsiQS4gQXQgXFwoMyArIDRqXFwpLCB0aGUgc2FtZSBwb2ludCIsIkIuIEF0IFxcKC0zICsgNGpcXCksIHJlZmxlY3RlZCBhY3Jvc3MgdGhlIGltYWdpbmFyeSBheGlzIiwiQy4gQXQgXFwoMyAtIDRqXFwpLCByZWZsZWN0ZWQgYWNyb3NzIHRoZSByZWFsIGF4aXMiLCJELiBBdCBcXCgtMyAtIDRqXFwpLCByZWZsZWN0ZWQgdGhyb3VnaCB0aGUgb3JpZ2luIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiVGhlIGNvbmp1Z2F0ZSBmbGlwcyB0aGUgc2lnbiBvZiB0aGUgaW1hZ2luYXJ5IGNvbXBvbmVudCBvbmx5LCBzbyBpdCByZWZsZWN0cyBhY3Jvc3MgdGhlIHJlYWwgYXhpcy4gVGhlIHBvaW50IG1vdmVzIGZyb20gXFwoKDMsIDQpXFwpIHRvIFxcKCgzLCAtNClcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiQSBjb25qdWdhdGUgY2hhbmdlcyB0aGUgc2lnbiBvZiB0aGUgXFwoalxcKS10ZXJtIHVubGVzcyB0aGUgaW1hZ2luYXJ5IHBhcnQgaXMgemVyby4iLCJCIjoiVGhhdCB3b3VsZCBmbGlwIHRoZSByZWFsIHBhcnQsIG5vdCB0aGUgaW1hZ2luYXJ5IHBhcnQuIiwiRCI6IlRoYXQgY2hhbmdlcyBib3RoIHNpZ25zLCB3aGljaCBpcyBub3QgY29uanVnYXRpb24g4oCUIGl0IGlzIG5lZ2F0aW9uLiJ9LCJoaW50IjoiT25seSB0aGUgdmVydGljYWwgY29vcmRpbmF0ZSBjaGFuZ2VzIHNpZ24uIiwibmVlZHNfdmlzdWFsIjp0cnVlLCJ2aXN1YWxfdHlwZSI6Im9wZW5haS9ncHQtNS40LWltYWdlLTIiLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6ImNvbnZlcnNpb25fYmV0d2Vlbl9mb3JtcyIsImxhYmVsIjoiUmVjdGFuZ3VsYXItcG9sYXIgY29udmVyc2lvbiBhbmQgcXVhZHJhbnQgY2hvaWNlIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AyX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGljaCBwb2xhciBmb3JtIGNvcnJlY3RseSByZXByZXNlbnRzIFxcKHogPSAtMiAtIDNqXFwpIHVzaW5nIGEgcHJpbmNpcGFsIGFuZ2xlIGluIGRlZ3JlZXM/Iiwib3B0aW9ucyI6WyJBLiBcXChcXHNxcnR7MTN9XFwsZV57ajU2LjNeXFxjaXJjfVxcKSIsIkIuIFxcKFxcc3FydHsxM31cXCxlXntqMTIzLjdeXFxjaXJjfVxcKSIsIkMuIFxcKFxcc3FydHsxM31cXCxlXnstajEyMy43XlxcY2lyY31cXCkiLCJELiBcXChcXHNxcnR7MTN9XFwsZV57LWo1Ni4zXlxcY2lyY31cXCkiXSwiY29ycmVjdF9vcHRpb24iOiJDIiwiZXhwbGFuYXRpb24iOiJUaGUgbWFnbml0dWRlIGlzIFxcKFxcc3FydHsoLTIpXjIrKC0zKV4yfSA9IFxcc3FydHsxM31cXCkuIFNpbmNlIGJvdGggXFwoYVxcKSBhbmQgXFwoYlxcKSBhcmUgbmVnYXRpdmUsIHRoZSBwb2ludCBsaWVzIGluIHF1YWRyYW50IElJSS4gQSBwcmluY2lwYWwgYW5nbGUgb2YgXFwoLTEyMy43XlxcY2lyY1xcKSBjb3JyZWN0bHkgcGxhY2VzIHRoZSBwb2ludCB0aGVyZS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJcXCg1Ni4zXlxcY2lyY1xcKSBpcyBhIHF1YWRyYW50IEkgYW5nbGUg4oCUIGJvdGggY29vcmRpbmF0ZXMgd291bGQgYmUgcG9zaXRpdmUgdGhlcmUuIiwiQiI6IlxcKDEyMy43XlxcY2lyY1xcKSBpcyBhIHF1YWRyYW50IElJIGFuZ2xlIOKAlCByZWFsIHBhcnQgd291bGQgYmUgbmVnYXRpdmUgYnV0IGltYWdpbmFyeSBwYXJ0IHBvc2l0aXZlLiIsIkQiOiJcXCgtNTYuM15cXGNpcmNcXCkgaXMgYSBxdWFkcmFudCBJViBhbmdsZSDigJQgcmVhbCBwYXJ0IHBvc2l0aXZlLCBpbWFnaW5hcnkgcGFydCBuZWdhdGl2ZS4ifSwiaGludCI6IlVzZSB0aGUgc2lnbnMgb2YgYm90aCBjb29yZGluYXRlcyBiZWZvcmUgdHJ1c3RpbmcgaW52ZXJzZSB0YW5nZW50LiIsIm5lZWRzX3Zpc3VhbCI6dHJ1ZSwidmlzdWFsX3R5cGUiOiJvcGVuYWkvZ3B0LTUuNC1pbWFnZS0yIiwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AyX3EyIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJDb252ZXJ0IFxcKDJlXntqXFxwaS8zfVxcKSB0byByZWN0YW5ndWxhciBmb3JtLiIsIm9wdGlvbnMiOlsiQS4gXFwoMSArIGpcXHNxcnR7M31cXCkiLCJCLiBcXChcXHNxcnR7M30gKyBqXFwpIiwiQy4gXFwoLTEgKyBqXFxzcXJ0ezN9XFwpIiwiRC4gXFwoMiArIGowXFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQSIsImV4cGxhbmF0aW9uIjoiVXNlIFxcKHogPSByKFxcY29zXFx0aGV0YSArIGpcXHNpblxcdGhldGEpXFwpLiBXaXRoIFxcKHIgPSAyXFwpIGFuZCBcXChcXHRoZXRhID0gXFxwaS8zXFwpOiBcXCh6ID0gMlxcbGVmdChcXGNvc1xcZnJhY3tcXHBpfXszfSArIGpcXHNpblxcZnJhY3tcXHBpfXszfVxccmlnaHQpID0gMlxcbGVmdChcXGZyYWN7MX17Mn0gKyBqXFxmcmFje1xcc3FydHszfX17Mn1cXHJpZ2h0KSA9IDEgKyBqXFxzcXJ0ezN9XFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQiI6IlRoZSBjb3NpbmUgYW5kIHNpbmUgdmFsdWVzIGFyZSByZXZlcnNlZCDigJQgXFwoXFxjb3MoXFxwaS8zKSA9IDEvMlxcKSwgbm90IFxcKFxcc3FydHszfS8yXFwpLiIsIkMiOiJUaGF0IHdvdWxkIGNvcnJlc3BvbmQgdG8gYW4gYW5nbGUgaW4gcXVhZHJhbnQgSUksIHN1Y2ggYXMgXFwoMlxccGkvM1xcKS4iLCJEIjoiVGhhdCB3b3VsZCBjb3JyZXNwb25kIHRvIGFuZ2xlIFxcKDBcXCksIG5vdCBcXChcXHBpLzNcXCkuIn0sImhpbnQiOiJTdWJzdGl0dXRlIFxcKFxcY29zKFxccGkvMylcXCkgYW5kIFxcKFxcc2luKFxccGkvMylcXCkgZmlyc3QsIHRoZW4gbXVsdGlwbHkgYnkgXFwoMlxcKS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfSx7ImlkIjoia3AyX3EzIiwidHlwZSI6InNob3J0X2Fuc3dlciIsInN0ZW0iOiJBIHN0dWRlbnQgY29tcHV0ZXMgXFwoXFx0aGV0YSA9IFxcdGFuXnstMX1cXCFcXGxlZnQoXFxmcmFjey0zfXstMn1cXHJpZ2h0KSA9IDU2LjNeXFxjaXJjXFwpIGZvciBcXCh6ID0gLTIgLSAzalxcKSBhbmQgc3RvcHMgdGhlcmUuIEV4cGxhaW4gcHJlY2lzZWx5IHdoYXQgd2VudCB3cm9uZy4iLCJpZGVhbF9hbnN3ZXIiOiJUaGUgcmF0aW8gZ2l2ZXMgYSByZWZlcmVuY2UgYW5nbGUsIG5vdCB0aGUgZmluYWwgYW5nbGUgYnkgaXRzZWxmLiBTaW5jZSBcXCgtMiAtIDNqXFwpIGxpZXMgaW4gcXVhZHJhbnQgSUlJIChib3RoIFxcKGEgPCAwXFwpIGFuZCBcXChiIDwgMFxcKSksIFxcKDU2LjNeXFxjaXJjXFwpIGlzIGluIHRoZSB3cm9uZyBxdWFkcmFudC4gVGhlIGFuZ2xlIG11c3QgYmUgYWRqdXN0ZWQgYnkgXFwoMTgwXlxcY2lyY1xcKSwgZ2l2aW5nIFxcKDIzNi4zXlxcY2lyY1xcKSBvciB0aGUgcHJpbmNpcGFsIGFuZ2xlIFxcKC0xMjMuN15cXGNpcmNcXCkuIiwiZ3JhZGluZ19ydWJyaWMiOlsiTXVzdCBzYXkgdGhhdCBcXCg1Ni4zXlxcY2lyY1xcKSBpcyBvbmx5IGEgcmVmZXJlbmNlIGFuZ2xlIG9yIHJhdyBjYWxjdWxhdG9yIG91dHB1dCIsIk11c3QgaWRlbnRpZnkgdGhlIGFjdHVhbCBxdWFkcmFudCBhcyBxdWFkcmFudCBJSUkiLCJNdXN0IGdpdmUgYSBjb3JyZWN0IGNvcnJlY3RlZCBhbmdsZSBzdWNoIGFzIFxcKDIzNi4zXlxcY2lyY1xcKSBvciBcXCgtMTIzLjdeXFxjaXJjXFwpIl0sImV4cGxhbmF0aW9uIjoiVGhpcyBjaGVja3Mgd2hldGhlciB0aGUgc3R1ZGVudCB1bmRlcnN0YW5kcyB0aGUgcXVhZHJhbnQgdHJhcCByYXRoZXIgdGhhbiBqdXN0IG1lbW9yaXppbmcgZm9ybXVsYXMuIFRoZSBpbnZlcnNlIHRhbmdlbnQgZnVuY3Rpb24gYWx3YXlzIHJldHVybnMgYSB2YWx1ZSBiZXR3ZWVuIFxcKC05MF5cXGNpcmNcXCkgYW5kIFxcKDkwXlxcY2lyY1xcKSwgc28gaXQgY2Fubm90IGRpc3Rpbmd1aXNoIHF1YWRyYW50IEkgZnJvbSBxdWFkcmFudCBJSUkgb24gaXRzIG93bi4iLCJoaW50IjoiRmlyc3QgZGVjaWRlIHdoZXJlIHRoZSBwb2ludCBpcyBvbiB0aGUgcGxhbmUsIHRoZW4gY2hvb3NlIHRoZSBhbmdsZSB0aGF0IGFjdHVhbGx5IGxhbmRzIHRoZXJlLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoiYmVzdF9mb3JtX2Zvcl9vcGVyYXRpb25zIiwibGFiZWwiOiJDaG9vc2luZyByZWN0YW5ndWxhciBvciBwb2xhciBmb3JtIGZvciBhcml0aG1ldGljIiwiaW1wb3J0YW5jZSI6Im1lZGl1bSIsImV4YW1fd2VpZ2h0IjoibWVkaXVtIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoxfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwM19xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hpY2ggc3RhdGVtZW50IGlzIHRoZSBiZXN0IHJ1bGUgb2YgdGh1bWIgZm9yIGNvbXBsZXgtbnVtYmVyIGFyaXRobWV0aWM/Iiwib3B0aW9ucyI6WyJBLiBBbHdheXMgdXNlIHJlY3Rhbmd1bGFyIGZvcm0gZm9yIGV2ZXJ5IG9wZXJhdGlvbiIsIkIuIEFsd2F5cyB1c2UgcG9sYXIgZm9ybSBmb3IgZXZlcnkgb3BlcmF0aW9uIiwiQy4gVXNlIHJlY3Rhbmd1bGFyIGZvcm0gZm9yIGFkZGl0aW9uL3N1YnRyYWN0aW9uIGFuZCBwb2xhciBmb3JtIGZvciBtdWx0aXBsaWNhdGlvbi9kaXZpc2lvbiIsIkQuIFRoZSBjaG9pY2Ugb2YgZm9ybSBuZXZlciBtYXR0ZXJzIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiQWRkaXRpb24gYW5kIHN1YnRyYWN0aW9uIGNvbWJpbmUgcmVhbCBhbmQgaW1hZ2luYXJ5IGNvbXBvbmVudHMgZGlyZWN0bHkgaW4gcmVjdGFuZ3VsYXIgZm9ybSwgd2hpbGUgbXVsdGlwbGljYXRpb24gYW5kIGRpdmlzaW9uIGFyZSBzaW1wbGVyIGluIHBvbGFyIGZvcm0gYmVjYXVzZSBtYWduaXR1ZGVzIG11bHRpcGx5IG9yIGRpdmlkZSBhbmQgYW5nbGVzIGFkZCBvciBzdWJ0cmFjdC4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJSZWN0YW5ndWxhciBmb3JtIGlzIG9mdGVuIGNsdW1zeSBmb3IgbXVsdGlwbGljYXRpb24gYW5kIGRpdmlzaW9uLCByZXF1aXJpbmcgdGhlIEZPSUwgbWV0aG9kIGFuZCBzaW1wbGlmaWNhdGlvbi4iLCJCIjoiUG9sYXIgZm9ybSBpcyBhd2t3YXJkIGZvciBhZGRpdGlvbiBhbmQgc3VidHJhY3Rpb24gYmVjYXVzZSB5b3UgY2Fubm90IHNpbXBseSBhZGQgbWFnbml0dWRlcyBhbmQgYW5nbGVzLiIsIkQiOiJUaGUgY2hvaWNlIG9mdGVuIGNoYW5nZXMgaG93IG11Y2ggYWxnZWJyYSBpcyByZXF1aXJlZCDigJQgcG9sYXIgZm9ybSBmb3IgbXVsdGlwbGljYXRpb24gaXMgZHJhbWF0aWNhbGx5IHNpbXBsZXIuIn0sImhpbnQiOiJUaGluazogYWRkIGNvb3JkaW5hdGVzLCBtdWx0aXBseSBtYWduaXR1ZGVzIGFuZCBhbmdsZXMuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50IjpmYWxzZX0seyJpZCI6ImtwM19xMiIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiU3VwcG9zZSBcXCh6XzFcXCkgYW5kIFxcKHpfMlxcKSBhcmUgYWxyZWFkeSB3cml0dGVuIGFzIFxcKHJfMSBlXntqXFx0aGV0YV8xfVxcKSBhbmQgXFwocl8yIGVee2pcXHRoZXRhXzJ9XFwpLiBXaGF0IGlzIHRoZSBmYXN0ZXN0IHdheSB0byBjb21wdXRlIFxcKHpfMSAvIHpfMlxcKT8iLCJvcHRpb25zIjpbIkEuIENvbnZlcnQgYm90aCB0byByZWN0YW5ndWxhciBmaXJzdCwgdGhlbiBkaXZpZGUgdGVybSBieSB0ZXJtIiwiQi4gRGl2aWRlIG1hZ25pdHVkZXMgYW5kIHN1YnRyYWN0IGFuZ2xlcyIsIkMuIEFkZCBtYWduaXR1ZGVzIGFuZCBkaXZpZGUgYW5nbGVzIiwiRC4gTXVsdGlwbHkgbWFnbml0dWRlcyBhbmQgYWRkIGFuZ2xlcyJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IkluIHBvbGFyIGZvcm0sIGRpdmlzaW9uIGJlY29tZXMgXFwoXFxmcmFje3pfMX17el8yfSA9IFxcZnJhY3tyXzF9e3JfMn1cXCxlXntqKFxcdGhldGFfMSAtIFxcdGhldGFfMil9XFwpLiBNYWduaXR1ZGVzIGRpdmlkZSBhbmQgYW5nbGVzIHN1YnRyYWN0LiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoYXQgdXN1YWxseSBjcmVhdGVzIHVubmVjZXNzYXJ5IGFsZ2VicmEgYW5kIGRlZmVhdHMgdGhlIHB1cnBvc2Ugb2YgaGF2aW5nIHBvbGFyIGZvcm0uIiwiQyI6IlRoYXQgaXMgbm90IGEgdmFsaWQgY29tcGxleC1udW1iZXIgcnVsZSBmb3IgYW55IG9wZXJhdGlvbi4iLCJEIjoiVGhhdCBpcyB0aGUgcnVsZSBmb3IgbXVsdGlwbGljYXRpb24gXFwoel8xIHpfMiA9IHJfMSByXzJcXCxlXntqKFxcdGhldGFfMStcXHRoZXRhXzIpfVxcKSwgbm90IGRpdmlzaW9uLiJ9LCJoaW50IjoiRGl2aXNpb24gcmV2ZXJzZXMgdGhlIG11bHRpcGxpY2F0aW9uIHJ1bGUg4oCUIHRoaW5rIGFib3V0IHdoYXQgaGFwcGVucyB0byB0aGUgZXhwb25lbnQuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfV19XX0=" style="display:none;"></div>%%KC_END%%
