%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImJvdGgiLCJyYXRpb25hbGUiOiJUaGlzIHNlY3Rpb24gaXMgaGlnaGx5IHZpc3VhbCBhbmQgdGhlIHRleHRib29rIGFscmVhZHkgY29udGFpbnMgc3Ryb25nIGNvbXBsZXgtcGxhbmUgZmlndXJlcyBmb3IgcmVwcmVzZW50YXRpb24gYW5kIGNvbnZlcnNpb24uIFVzZSB0aGUgdGV4dGJvb2sgZmlndXJlcyBhcyB0aGUgbWFpbiBldmlkZW5jZSBhbmNob3IsIGFuZCBhZGQgb25lIGNsZWFuIGdlbmVyYXRlZCB0ZWFjaGluZyB2aXN1YWwgb25seSB3aGVyZSBhIHNpbXBsZXIgZXhhbS1mb2N1c2VkIGNvbXBhcmlzb24gbWFrZXMgdGhlIHJlY3Rhbmd1bGFyLXZzLXBvbGFyIGNob2ljZSBpbW1lZGlhdGVseSBjbGVhci4iLCJjcmFtIjoiVXNlIHZpc3VhbHMgdG8gaGVscCBzdHVkZW50cyBzcG90IHRoZSBmb3JtLCByZWFkIG1hZ25pdHVkZS9hbmdsZSBmYXN0LCBhbmQgYXZvaWQgcXVhZHJhbnQgbWlzdGFrZXMuIiwic3RhbmRhcmQiOiJVc2UgdmlzdWFscyB0byBleHBsYWluIHRoZSBjb21wbGV4IHBsYW5lIGNsZWFybHksIHRoZW4gc3VwcG9ydCBvbmUgcmVwcmVzZW50YXRpdmUgY29udmVyc2lvbiBleGFtcGxlIGFuZCBvbmUgZm9ybS1zZWxlY3Rpb24gcnVsZSBmb3IgYXJpdGhtZXRpYy4iLCJ0b3Bfc2NvcmUiOiJVc2UgdmlzdWFscyB0byBlbXBoYXNpemUgY29uanVnYXRlIHJlZmxlY3Rpb24sIHByaW5jaXBhbCBhbmdsZSBjaG9pY2UsIGVxdWl2YWxlbnQgYW5nbGVzIGRpZmZlcmluZyBieSAyz4AsIGFuZCB3aGVuIGVhY2ggZm9ybSBpcyBjb21wdXRhdGlvbmFsbHkgc3VwZXJpb3IuIn0=" style="display:none;"></div>%%KC_END%%
# B.1 Complex Numbers

> **Section Objective:** Master three practical skills — reading complex numbers on the complex plane, converting between rectangular and polar form, and choosing the right form for arithmetic.

Complex numbers are not a strange detour. They are a compact, practical language used throughout signals and systems to describe magnitude and phase together in a single symbol. This section teaches you three things: how to read \ (z = a + jb\) as a point on the complex plane, how to switch between rectangular and polar form, and how to decide which form makes a given calculation easier.

### EXAM VALUE

Exam questions in this area typically test magnitude and angle computation, quadrant-based angle selection, conjugate operations, and the choice between Cartesian and polar form. Getting these right is a reliable source of marks.

## 1. Reading a Complex Number on the Complex Plane

A complex number \(z = a + jb\) is simply a point in a two-dimensional plane. The horizontal axis is the **real axis** and the vertical axis is the **imaginary axis**. The real part is \(\text{Re}(z) = a\) and the imaginary part is \(\text{Im}(z) = b\). There is nothing mysterious here — it is just a coordinate system.

**Magnitude** \(r = |z|\) is the straight-line distance from the origin to the point. **Angle** \(\theta\) is the direction measured counterclockwise from the positive real axis.

#### Exam Note

The imaginary part is \(b\), not \(jb\). The symbol \(j\) is the axis marker, not part of the value.

### QUICK EXAMPLE

For \(z = 3 + 4j\), the point sits at coordinates \((3,\, 4)\) on the complex plane — three units right, four units up.

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="book_image" data-teaching-role="concept_anchor" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoaXMgZmlndXJlIHRvIGluc3RhbnRseSBjb25uZWN0IGEgKyBqYiB3aXRoIGl0cyBwb2ludCwgbWFnbml0dWRlLCBhbmdsZSwgYW5kIGNvbmp1Z2F0ZSByZWZsZWN0aW9uIOKAlCBhbGwgaW4gb25lIGdsYW5jZS4iLCJzdGFuZGFyZCI6IlVzZSB0aGlzIGZpZ3VyZSB0byBleHBsYWluIHRoZSBjb29yZGluYXRlIG1lYW5pbmcgb2YgcmVhbCBwYXJ0LCBpbWFnaW5hcnkgcGFydCwgbWFnbml0dWRlLCBhbmQgYW5nbGUgdG9nZXRoZXIgaW4gb25lIHBpY3R1cmUuIiwidG9wX3Njb3JlIjoiVXNlIHRoaXMgZmlndXJlIHRvIGhpZ2hsaWdodCB0aGF0IHogYW5kIHoqIHNoYXJlIHRoZSBzYW1lIG1hZ25pdHVkZSBhbmQgcmVmbGVjdCBhY3Jvc3MgdGhlIHJlYWwgYXhpcyB3aGlsZSB0aGVpciBhbmdsZXMgY2hhbmdlIHNpZ24uIn0=" style="display:none;"></div>%%KC_END%%
![Fig. B.2](/figures/page-005-fig__b_2-1.png)
*A complex number \(z = a + jb\) can be read as both a coordinate pair \((a, b)\) and as a magnitude-angle point \(re^{j\theta}\) on the complex plane, with its conjugate \(z^* = a - jb\) mirrored symmetrically across the real axis.*

$$z = a + jb = r(\cos\theta + j\sin\theta) = re^{j\theta}$$
*These are three equivalent ways to describe the same complex number: rectangular form gives the horizontal and vertical coordinates \((a, b)\), trigonometric polar form expresses those coordinates through radius \(r\) and angle \(\theta\), and exponential polar form compresses the same information into the compact symbol \(re^{j\theta}\) — all three point to exactly the same location on the complex plane.*

## 2. Converting Between Rectangular and Polar Form

The conversion rules follow directly from the geometry of the complex plane.

**Rectangular to polar:**
$$
r = \sqrt{a^2 + b^2}, \qquad \theta = \text{angle of the point } (a, b)
$$

**Polar to rectangular:**
$$
a = r\cos\theta, \qquad b = r\sin\theta
$$

### WORKED EXAMPLE

Convert \(z = -2 - 3j\) to polar form.

**Step 1 — Magnitude:**
$$
r = \sqrt{(-2)^2 + (-3)^2} = \sqrt{4 + 9} = \sqrt{13} \approx 3.61
$$

**Step 2 — Angle with quadrant check:**
A calculator gives \(\tan^{-1}(3/2) \approx 56.3^\circ\) as the reference angle. But the point \((-2, -3)\) lies in **quadrant III** — both coordinates are negative. The correct principal angle must point into quadrant III, so:
$$
\theta \approx -(180^\circ - 56.3^\circ) = -123.7^\circ
$$

Result: \(z = \sqrt{13}\, e^{-j123.7^\circ}\).

### QUICK CHECK

What quadrant does \(1 - 3j\) lie in? The real part is positive and the imaginary part is negative, so the point is in **quadrant IV** — the angle will be negative.

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="book_image" data-teaching-role="exam_pattern_anchor" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoaXMgZmlndXJlIHRvIHRyYWluIGZhc3QgcXVhZHJhbnQgcmVjb2duaXRpb24gZm9yIHJlY3Rhbmd1bGFyLXRvLXBvbGFyIGNvbnZlcnNpb24uIiwic3RhbmRhcmQiOiJVc2UgdGhpcyBmaWd1cmUgdG8gc3VwcG9ydCB0aGUgd29ya2VkIGV4YW1wbGUgYnkgc2hvd2luZyBob3cgbWFnbml0dWRlIGFuZCBhbmdsZSBjaGFuZ2UgYWNyb3NzIGFsbCBmb3VyIHF1YWRyYW50cy4iLCJ0b3Bfc2NvcmUiOiJVc2UgdGhpcyBmaWd1cmUgdG8gc3RyZXNzIHByaW5jaXBhbCBhbmdsZSBjaG9pY2UgYW5kIHdoeSB0aGUgc2FtZSBwb2ludCBjYW4gYmUgZGVzY3JpYmVkIGJ5IG11bHRpcGxlIGVxdWl2YWxlbnQgYW5nbGVzIGRpZmZlcmluZyBieSBcXCgyXFxwaVxcKS4ifQ==" style="display:none;"></div>%%KC_END%%
![unknown](/figures/page-009-unknown-1.png)
*The same rectangular-to-polar conversion method applies in every quadrant, but the angle must be chosen to match the point's actual location on the complex plane — a calculator's raw inverse-tangent output is only the reference angle.*

## 3. Conjugates and Choosing the Right Form for Arithmetic

The **complex conjugate** of \(z = a + jb\) is \(z^* = a - jb\). Geometrically, this reflects the point across the real axis — the magnitude stays the same and the angle changes sign.

Two high-yield identities follow immediately:

$$
z z^* = |z|^2, \qquad \frac{1}{z} = \frac{z^*}{|z|^2}
$$

These are useful whenever you need to rationalize a complex denominator.

### OPERATIONAL RULE

| Operation | Easier form |
|-----------|-------------|
| Addition, subtraction | Rectangular \(a + jb\) |
| Multiplication, division | Polar \(re^{j\theta}\) |

**Why?** In polar form, magnitudes multiply and angles add — no cross-term algebra needed.

### BRIEF EXAMPLE

Given \(z_1 = 3 + 4j\) and \(z_2 = 2 + 3j\):
- **Sum** \(z_1 + z_2\): stay in rectangular — just add real and imaginary parts separately.
- **Product** \(z_1 z_2\): convert both to polar, multiply magnitudes, add angles.

### EXAM NOTE

Roots of complex numbers have multiple values (\(n\) roots for an \(n\)th root). This course focuses on the principal value, but be aware that additional solutions exist.

---
**📌 Key Takeaways**
- \(z = a + jb\) places a point at coordinates \((a, b)\) on the complex plane, with \(\text{Re}(z) = a\) and \(\text{Im}(z) = b\).
- Convert to polar using \(r = \sqrt{a^2 + b^2}\) and a quadrant-checked angle — never trust the raw inverse-tangent output alone.
- Use rectangular form for addition and subtraction; use polar form for multiplication, division, and powers.

*In the next section we will move from complex numbers to sinusoids and phase.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NywicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo2LCJtYXgiOjh9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InJlY3Rhbmd1bGFyX21lYW5pbmciLCJsYWJlbCI6IlJlYWwgcGFydCwgaW1hZ2luYXJ5IHBhcnQsIGFuZCBjb21wbGV4LXBsYW5lIGNvb3JkaW5hdGVzIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AxX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJGb3IgXFwoeiA9IDUgLSAyalxcKSwgd2hpY2ggc3RhdGVtZW50IGlzIGNvcnJlY3Q/Iiwib3B0aW9ucyI6WyJBLiBcXChcXHRleHR7UmV9KHopID0gLTJcXCkgYW5kIFxcKFxcdGV4dHtJbX0oeikgPSA1XFwpIiwiQi4gXFwoXFx0ZXh0e1JlfSh6KSA9IDVcXCkgYW5kIFxcKFxcdGV4dHtJbX0oeikgPSAtMlxcKSIsIkMuIFxcKFxcdGV4dHtSZX0oeikgPSA1XFwpIGFuZCBcXChcXHRleHR7SW19KHopID0gLTJqXFwpIiwiRC4gVGhlIHBvaW50IGlzIHBsb3R0ZWQgYXQgXFwoKC0yLFxcLCA1KVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IkluIFxcKHogPSBhICsgamJcXCksIHRoZSByZWFsIHBhcnQgaXMgdGhlIGhvcml6b250YWwgY29vcmRpbmF0ZSBcXChhXFwpIGFuZCB0aGUgaW1hZ2luYXJ5IHBhcnQgaXMgdGhlIGNvZWZmaWNpZW50IFxcKGJcXCkgb2YgXFwoalxcKS4gSGVyZSBcXChhID0gNVxcKSBhbmQgXFwoYiA9IC0yXFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoaXMgc3dhcHMgdGhlIHJlYWwgYW5kIGltYWdpbmFyeSBwYXJ0cy4iLCJDIjoiVGhlIGltYWdpbmFyeSBwYXJ0IGlzIHRoZSBjb2VmZmljaWVudCBcXCgtMlxcKSwgbm90IHRoZSBmdWxsIHRlcm0gXFwoLTJqXFwpLiIsIkQiOiJUaGUgcG9pbnQgc2hvdWxkIGJlIHBsb3R0ZWQgYXQgXFwoKDUsXFwsIC0yKVxcKSwgbm90IFxcKCgtMixcXCwgNSlcXCkuIn0sImhpbnQiOiJSZWFkIHRoZSBjb2VmZmljaWVudCBvZiBcXChqXFwpIHNlcGFyYXRlbHkgZnJvbSB0aGUgc3ltYm9sIFxcKGpcXCkgaXRzZWxmLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX0seyJpZCI6ImtwMV9xMiIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hpY2ggcG9pbnQgb24gdGhlIGNvbXBsZXggcGxhbmUgcmVwcmVzZW50cyBcXCh6ID0gLTMgKyA0alxcKT8iLCJvcHRpb25zIjpbIkEuIFxcKCgzLFxcLCA0KVxcKSIsIkIuIFxcKCgtMyxcXCwgLTQpXFwpIiwiQy4gXFwoKC0zLFxcLCA0KVxcKSIsIkQuIFxcKCg0LFxcLCAtMylcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJDIiwiZXhwbGFuYXRpb24iOiJUaGUgcmVhbCBwYXJ0IGdpdmVzIHRoZSBob3Jpem9udGFsIGNvb3JkaW5hdGUgYW5kIHRoZSBjb2VmZmljaWVudCBvZiBcXChqXFwpIGdpdmVzIHRoZSB2ZXJ0aWNhbCBjb29yZGluYXRlLCBzbyB0aGUgcG9pbnQgaXMgXFwoKC0zLFxcLCA0KVxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGlzIGlnbm9yZXMgdGhlIG5lZ2F0aXZlIHNpZ24gb24gdGhlIHJlYWwgcGFydC4iLCJCIjoiVGhpcyBtYWtlcyB0aGUgaW1hZ2luYXJ5IHBhcnQgbmVnYXRpdmUgZXZlbiB0aG91Z2ggaXQgaXMgXFwoKzRcXCkuIiwiRCI6IlRoaXMgc3dhcHMgdGhlIHR3byBjb29yZGluYXRlcy4ifSwiaGludCI6IlVzZSBcXCgoXFx0ZXh0e1JlfSh6KSxcXCwgXFx0ZXh0e0ltfSh6KSlcXCkgYXMgdGhlIGNvb3JkaW5hdGUgcGFpci4iLCJuZWVkc192aXN1YWwiOnRydWUsInZpc3VhbF90eXBlIjoib3BlbmFpL2dwdC01LjQtaW1hZ2UtMiIsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoicmVjdGFuZ3VsYXJfcG9sYXJfY29udmVyc2lvbiIsImxhYmVsIjoiTWFnbml0dWRlLWFuZ2xlIGNvbnZlcnNpb24gYW5kIHF1YWRyYW50IHNlbGVjdGlvbiIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJoaWdoIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoyfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwMl9xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hhdCBpcyB0aGUgbWFnbml0dWRlIG9mIFxcKHogPSAtMiAtIDNqXFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoNVxcKSIsIkIuIFxcKFxcc3FydHsxM31cXCkiLCJDLiBcXCgtXFxzcXJ0ezEzfVxcKSIsIkQuIFxcKFxcc3FydHs1fVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6Ik1hZ25pdHVkZSBpcyB0aGUgZGlzdGFuY2UgZnJvbSB0aGUgb3JpZ2luOiBcXCh8enwgPSBcXHNxcnR7KC0yKV4yICsgKC0zKV4yfSA9IFxcc3FydHs0ICsgOX0gPSBcXHNxcnR7MTN9XFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoaXMgYWRkcyB0aGUgYWJzb2x1dGUgdmFsdWVzIGluc3RlYWQgb2YgdXNpbmcgdGhlIGRpc3RhbmNlIGZvcm11bGEuIiwiQyI6Ik1hZ25pdHVkZSBpcyBhbHdheXMgbm9uLW5lZ2F0aXZlLiIsIkQiOiJUaGlzIHVzZXMgaW5jb3JyZWN0IHNxdWFyZXMuIn0sImhpbnQiOiJBcHBseSBcXChcXHNxcnR7YV4yICsgYl4yfVxcKSB3aXRoIFxcKGEgPSAtMlxcKSBhbmQgXFwoYiA9IC0zXFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9LHsiaWQiOiJrcDJfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IkEgY2FsY3VsYXRvciBnaXZlcyBcXChcXHRhbl57LTF9XFwhXFxsZWZ0KFxcdGZyYWN7LTN9ey0yfVxccmlnaHQpIFxcYXBwcm94IDU2LjNeXFxjaXJjXFwpIGZvciBcXCh6ID0gLTIgLSAzalxcKS4gV2hhdCBpcyB0aGUgY29ycmVjdCBwcmluY2lwYWwgYW5nbGU/Iiwib3B0aW9ucyI6WyJBLiBcXCg1Ni4zXlxcY2lyY1xcKSIsIkIuIFxcKDEyMy43XlxcY2lyY1xcKSIsIkMuIFxcKC0xMjMuN15cXGNpcmNcXCkiLCJELiBcXCgtNTYuM15cXGNpcmNcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJDIiwiZXhwbGFuYXRpb24iOiJUaGUgcG9pbnQgXFwoKC0yLFxcLCAtMylcXCkgbGllcyBpbiBxdWFkcmFudCBJSUksIHNvIHRoZSBhbmdsZSBtdXN0IHBvaW50IGludG8gcXVhZHJhbnQgSUlJLiBUaGUgY29ycmVjdCBwcmluY2lwYWwgYW5nbGUgaXMgYXBwcm94aW1hdGVseSBcXCgtMTIzLjdeXFxjaXJjXFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlxcKDU2LjNeXFxjaXJjXFwpIGlzIG9ubHkgdGhlIHJlZmVyZW5jZSBhbmdsZSBhbmQgcG9pbnRzIHRvd2FyZCBxdWFkcmFudCBJLiIsIkIiOiJcXCgxMjMuN15cXGNpcmNcXCkgcG9pbnRzIGludG8gcXVhZHJhbnQgSUksIG5vdCBJSUkuIiwiRCI6IlxcKC01Ni4zXlxcY2lyY1xcKSBwb2ludHMgaW50byBxdWFkcmFudCBJViwgbm90IElJSS4ifSwiaGludCI6IkNoZWNrIHRoZSBxdWFkcmFudCBvZiB0aGUgcG9pbnQgYmVmb3JlIHRydXN0aW5nIHRoZSBpbnZlcnNlLXRhbmdlbnQgb3V0cHV0LiIsIm5lZWRzX3Zpc3VhbCI6dHJ1ZSwidmlzdWFsX3R5cGUiOiJvcGVuYWkvZ3B0LTUuNC1pbWFnZS0yIiwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AyX3EzIiwidHlwZSI6InNob3J0X2Fuc3dlciIsInN0ZW0iOiJDb252ZXJ0IFxcKDEgLSAzalxcKSB0byBwb2xhciBmb3JtLiBHaXZlIHRoZSBtYWduaXR1ZGUgYW5kIGEgY29ycmVjdCBwcmluY2lwYWwgYW5nbGUgaW4gZGVncmVlcy4iLCJpZGVhbF9hbnN3ZXIiOiJNYWduaXR1ZGUgaXMgXFwoXFxzcXJ0ezFeMiArICgtMyleMn0gPSBcXHNxcnR7MTB9IFxcYXBwcm94IDMuMTZcXCkuIFRoZSBwb2ludCBcXCgoMSwgLTMpXFwpIGlzIGluIHF1YWRyYW50IElWLCBzbyB0aGUgcHJpbmNpcGFsIGFuZ2xlIGlzIGFwcHJveGltYXRlbHkgXFwoLTcxLjZeXFxjaXJjXFwpLiBUaGVyZWZvcmUgXFwoeiA9IFxcc3FydHsxMH1cXCwgZV57LWo3MS42XlxcY2lyY31cXCkuIiwiZ3JhZGluZ19ydWJyaWMiOlsiTXVzdCBjb21wdXRlIG1hZ25pdHVkZSBhcyBcXChcXHNxcnR7MTB9XFwpIG9yIGFuIGVxdWl2YWxlbnQgY29ycmVjdCBkZWNpbWFsIiwiTXVzdCBpZGVudGlmeSB0aGUgcG9pbnQgYXMgbHlpbmcgaW4gcXVhZHJhbnQgSVYiLCJNdXN0IGdpdmUgYSBwcmluY2lwYWwgYW5nbGUgY2xvc2UgdG8gXFwoLTcxLjZeXFxjaXJjXFwpIl0sImV4cGxhbmF0aW9uIjoiVGhpcyBjaGVja3Mgd2hldGhlciB0aGUgc3R1ZGVudCBjYW4gY29tYmluZSB0aGUgZGlzdGFuY2UgY2FsY3VsYXRpb24gd2l0aCBxdWFkcmFudC1hd2FyZSBhbmdsZSBzZWxlY3Rpb24gcmF0aGVyIHRoYW4gYmxpbmRseSB1c2luZyB0aGUgY2FsY3VsYXRvciBvdXRwdXQuIiwiaGludCI6IkNvbXB1dGUgdGhlIG1hZ25pdHVkZSBmaXJzdCB1c2luZyBcXChcXHNxcnR7YV4yICsgYl4yfVxcKSwgdGhlbiBkZXRlcm1pbmUgdGhlIHF1YWRyYW50IGZyb20gdGhlIHNpZ25zIG9mIFxcKGFcXCkgYW5kIFxcKGJcXCkgYmVmb3JlIGZpbmRpbmcgdGhlIGFuZ2xlLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoiY29uanVnYXRlc19hbmRfZm9ybV9jaG9pY2UiLCJsYWJlbCI6IkNvbmp1Z2F0ZXMgYW5kIHNlbGVjdGluZyByZWN0YW5ndWxhciB2cyBwb2xhciBmb3JtIGZvciBvcGVyYXRpb25zIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6Im1lZGl1bSIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDNfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IklmIFxcKHogPSA0ICsgN2pcXCksIHdoYXQgaXMgXFwoel4qXFwpPyIsIm9wdGlvbnMiOlsiQS4gXFwoLTQgKyA3alxcKSIsIkIuIFxcKDQgLSA3alxcKSIsIkMuIFxcKC00IC0gN2pcXCkiLCJELiBcXCg3ICsgNGpcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJUaGUgY29uanVnYXRlIGtlZXBzIHRoZSByZWFsIHBhcnQgdW5jaGFuZ2VkIGFuZCBmbGlwcyB0aGUgc2lnbiBvZiB0aGUgaW1hZ2luYXJ5IHRlcm06IFxcKHpeKiA9IDQgLSA3alxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGUgcmVhbCBwYXJ0IHNob3VsZCBub3QgY2hhbmdlIHNpZ24uIiwiQyI6Ik9ubHkgdGhlIHNpZ24gb2YgdGhlIGltYWdpbmFyeSB0ZXJtIGNoYW5nZXMsIG5vdCB0aGUgcmVhbCBwYXJ0LiIsIkQiOiJUaGlzIHN3YXBzIHRoZSByZWFsIGFuZCBpbWFnaW5hcnkgY29tcG9uZW50cyBlbnRpcmVseS4ifSwiaGludCI6IlJlcGxhY2UgXFwoalxcKSB3aXRoIFxcKC1qXFwpIGFuZCBsZWF2ZSB0aGUgcmVhbCBwYXJ0IGFsb25lLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9LHsiaWQiOiJrcDNfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIHBhaXJpbmcgb2Ygb3BlcmF0aW9uIGFuZCBmb3JtIGlzIG1vc3QgY29tcHV0YXRpb25hbGx5IGVmZmljaWVudD8iLCJvcHRpb25zIjpbIkEuIEFkZCBpbiBwb2xhciBmb3JtOyBtdWx0aXBseSBpbiByZWN0YW5ndWxhciBmb3JtIiwiQi4gQWRkIGluIHJlY3Rhbmd1bGFyIGZvcm07IG11bHRpcGx5IGluIHBvbGFyIGZvcm0iLCJDLiBCb3RoIGFkZGl0aW9uIGFuZCBtdWx0aXBsaWNhdGlvbiBhcmUgZWFzaWVzdCBpbiByZWN0YW5ndWxhciBmb3JtIiwiRC4gQm90aCBhZGRpdGlvbiBhbmQgbXVsdGlwbGljYXRpb24gYXJlIGVhc2llc3QgaW4gcG9sYXIgZm9ybSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IkFkZGl0aW9uIGFuZCBzdWJ0cmFjdGlvbiBhcmUgc3RyYWlnaHRmb3J3YXJkIGluIHJlY3Rhbmd1bGFyIGZvcm0g4oCUIGp1c3QgY29tYmluZSByZWFsIGFuZCBpbWFnaW5hcnkgcGFydHMgc2VwYXJhdGVseS4gTXVsdGlwbGljYXRpb24gYW5kIGRpdmlzaW9uIGFyZSBlYXNpZXIgaW4gcG9sYXIgZm9ybSBiZWNhdXNlIG1hZ25pdHVkZXMgbXVsdGlwbHkgYW5kIGFuZ2xlcyBhZGQsIHdpdGggbm8gY3Jvc3MtdGVybSBhbGdlYnJhLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoaXMgcmV2ZXJzZXMgdGhlIHN0YW5kYXJkIGNvbnZlbmllbmNlIHJ1bGUuIiwiQyI6Ik11bHRpcGxpY2F0aW9uIGlzIHR5cGljYWxseSBjbGVhbmVyIGluIHBvbGFyIGZvcm0uIiwiRCI6IkFkZGl0aW9uIGlzIHR5cGljYWxseSBjbGVhbmVyIGluIHJlY3Rhbmd1bGFyIGZvcm0uIn0sImhpbnQiOiJUaGluazogY29tYmluZSBjb29yZGluYXRlcyBmb3Igc3VtczsgY29tYmluZSBtYWduaXR1ZGVzIGFuZCBhbmdsZXMgZm9yIHByb2R1Y3RzLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfV19" style="display:none;"></div>%%KC_END%%
