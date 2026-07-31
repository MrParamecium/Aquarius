%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImdlbmVyYXRlZF9pbWFnZSIsInJhdGlvbmFsZSI6IlRoaXMgc3Vic2VjdGlvbiBpcyBhIGNvbXBhY3QgZm9ybXVsYSByZWZlcmVuY2Ugd2l0aCBubyBleHRyYWN0ZWQgdGV4dGJvb2sgZmlndXJlcyBhdmFpbGFibGUuIEEgY2xlYW4gZ2VuZXJhdGVkIGNvbXBhcmlzb24gdmlzdWFsIHdpbGwgbWFrZSB0aGUgZm9ybXVsYSBmYW1pbGllcyBlYXNpZXIgdG8gZGlzdGluZ3Vpc2ggdGhhbiByYXcgT0NSIGFsb25lLiIsImNyYW0iOiJVc2Ugb25lIHZpc3VhbCB0byBzb3J0IHRoZSBmb3JtdWxhcyBieSBwYXR0ZXJuIHNvIHRoZSBzdHVkZW50IGNhbiBxdWlja2x5IG1hdGNoIGEgcHJvYmxlbSBmb3JtIHRvIHRoZSByaWdodCByZWZlcmVuY2UuIiwic3RhbmRhcmQiOiJVc2Ugb25lIHZpc3VhbCB0byBzaG93IHRoZSB0aHJlZSBtYWluIGZhbWlsaWVzOiBnZW9tZXRyaWMgc3Vtcywgb3JkaW5hcnkgaW50ZWdlciBzdW1zLCBhbmQgd2VpZ2h0ZWQgZ2VvbWV0cmljIHN1bXMsIHRoZW4gc3VwcG9ydCBvbmUgcmVwcmVzZW50YXRpdmUgZXhhbXBsZS4iLCJ0b3Bfc2NvcmUiOiJVc2UgdGhlIHZpc3VhbCB0byBlbXBoYXNpemUgcGF0dGVybiByZWNvZ25pdGlvbiwgaW5kZXggYm91bmRzLCB0aGUgY29uZGl0aW9uIHIgbm90IGVxdWFsIHRvIDEsIGFuZCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHBsYWluIHN1bXMgYW5kIHdlaWdodGVkIHN1bXMuIn0=" style="display:none;"></div>%%KC_END%%
# B.8-3 Sums — Formula Reference

> **Section Objective:** Build a fast, reliable toolkit for evaluating closed-form sums — no re-deriving required.

This subsection is a **formula toolbox**, not a proof section. It collects the most useful closed-form results for summing sequences: geometric sums, the standard sums of integers and squares, and weighted geometric sums.

By the end of this page you will be able to:
- Inspect a sum and **recognize its pattern**
- **Select the matching formula** without hesitation
- **Avoid wasting time** re-deriving results during problem solving

### WHY THIS MATTERS

These formulas appear constantly in signals, series expansions, and algebra-heavy derivations. Knowing them cold is a genuine time-saver on any timed exam.

## 1. Recognize the Sum Pattern First

This subsection contains three useful formula families:

| Family | What the term looks like | Formula to use |
|---|---|---|
| Geometric sum | \(r^k\) | Geometric series formula |
| Integer sums | \(k\) or \(k^2\) | Standard reference formulas |
| Weighted geometric | \(k \cdot r^k\) or \(k^2 \cdot r^k\) | Weighted geometric formulas |

**Before touching any algebra, inspect the term being added:**
- If the term is a pure power \(r^k\) — use the **geometric formula**
- If the term is \(k\) or \(k^2\) — use the **standard integer formulas**
- If \(k\) multiplies \(r^k\) — use the **weighted geometric formulas**

### EXAM TIP

Index limits matter. This page includes sums starting at \(k = 0\) and a geometric form written from \(k = m\) to \(n\). Always check your lower bound before substituting.

$$\sum_{k=m}^{n} r^k = \frac{r^{n+1}-r^m}{r-1}, \quad r \ne 1$$
*This is the finite geometric-series formula with a **general starting index** \(m\) — it does not have to start at \(k = 0\). The formula is valid **only when \(r \ne 1\)**; if \(r = 1\), every term equals 1 and the sum is simply \(n - m + 1\), so the formula's denominator would be zero and must not be used.*

$$\sum_{k=0}^{n} k = \frac{n(n+1)}{2}, \qquad \sum_{k=0}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}$$
*These are the two standard reference formulas for the sum of the first \(n\) integers and the sum of their squares. They appear often enough in signals, algebra, and series problems that you should know them **cold** — treat them as memorization-level facts, not something to re-derive.*

## 2. One Representative Example

Evaluate \(\displaystyle\sum_{k=2}^{5} 3^k\).

**Setup:** The term is \(3^k\), a pure power, so use the geometric formula with \(r = 3\), \(m = 2\), \(n = 5\).

$$
\sum_{k=2}^{5} 3^k = \frac{3^{5+1} - 3^2}{3 - 1} = \frac{3^6 - 9}{2} = \frac{729 - 9}{2} = \frac{720}{2} = 360
$$

**Quick check:** What if the lower limit were \(k = 0\) instead of \(k = 2\)? The same formula still works — \(r^m\) becomes \(r^0 = 1\), so the numerator becomes \(r^{n+1} - 1\). No special case needed.

### EXAM TIP

Index mistakes — using the wrong \(m\) or \(n\) — are **more common than algebra mistakes** here. Write out \(r\), \(m\), and \(n\) explicitly before substituting.

$$\sum_{k=0}^{n} k r^k = \frac{r + [n(r-1)-1]r^{n+1}}{(r-1)^2}, \quad r \ne 1$$
*This is a **weighted geometric sum**: each power \(r^k\) is multiplied by the weight \(k\), making it fundamentally different from an ordinary geometric series. Treat this as a **reference formula to recognize and look up**, not one to re-derive during a timed problem — the derivation is lengthy and error-prone under pressure.*

---
**📌 Key Takeaways**
- Inspect the term being summed first — match its pattern to the correct formula family before doing any algebra.
- Memorize the standard formulas: \(\sum k = \frac{n(n+1)}{2}\) and \(\sum k^2 = \frac{n(n+1)(2n+1)}{6}\).
- Always check index limits and confirm \(r \ne 1\) before applying any geometric-series formula.

*In the next section we will move to another reference formula family from the appendix.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InBhdHRlcm5fcmVjb2duaXRpb24iLCJsYWJlbCI6IklkZW50aWZ5IHdoaWNoIHN1bSBmb3JtdWxhIGFwcGxpZXMiLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6Mn0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDFfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGZvcm11bGEgZmFtaWx5IHNob3VsZCB5b3UgdXNlIGZpcnN0IGZvciBcXChcXHN1bV97az0wfV57bn0gNV5rXFwpPyIsIm9wdGlvbnMiOlsiQS4gU3VtIG9mIGludGVnZXJzIiwiQi4gU3VtIG9mIHNxdWFyZXMiLCJDLiBHZW9tZXRyaWMgc2VyaWVzIiwiRC4gV2VpZ2h0ZWQgZ2VvbWV0cmljIHNlcmllcyJdLCJjb3JyZWN0X29wdGlvbiI6IkMiLCJleHBsYW5hdGlvbiI6IlRoZSB0ZXJtIGJlaW5nIGFkZGVkIGlzIGEgcHVyZSBwb3dlciwgXFwoNV5rXFwpLCBzbyB0aGlzIGlzIGEgZ2VvbWV0cmljIHNlcmllcy4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGF0IGFwcGxpZXMgdG8gc3VtcyBsaWtlIFxcKFxcc3VtIGtcXCksIG5vdCBwb3dlcnMgbGlrZSBcXCg1XmtcXCkuIiwiQiI6IlRoYXQgYXBwbGllcyB0byBzdW1zIGxpa2UgXFwoXFxzdW0ga14yXFwpLCBub3QgcG93ZXJzIGxpa2UgXFwoNV5rXFwpLiIsIkQiOiJXZWlnaHRlZCBnZW9tZXRyaWMgc3VtcyBoYXZlIGFuIGV4dHJhIGZhY3RvciBzdWNoIGFzIFxcKGtcXCkgbXVsdGlwbHlpbmcgXFwocl5rXFwpLiJ9LCJoaW50IjoiTG9vayBhdCB0aGUgdGVybSBpbnNpZGUgdGhlIHN1bS4gSXMgaXQganVzdCBhIHBvd2VyLCBvciBpcyBpdCBtdWx0aXBsaWVkIGJ5IFxcKGtcXCk/IiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AxX3EyIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGljaCBleHByZXNzaW9uIGlzIGEgd2VpZ2h0ZWQgZ2VvbWV0cmljIHN1bT8iLCJvcHRpb25zIjpbIkEuIFxcKFxcc3VtX3trPTB9XntufSByXmtcXCkiLCJCLiBcXChcXHN1bV97az0wfV57bn0ga1xcKSIsIkMuIFxcKFxcc3VtX3trPTB9XntufSBrXjJcXCkiLCJELiBcXChcXHN1bV97az0wfV57bn0gayByXmtcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJEIiwiZXhwbGFuYXRpb24iOiJBIHdlaWdodGVkIGdlb21ldHJpYyBzdW0gaGFzIGJvdGggdGhlIHBvd2VyIHRlcm0gYW5kIGEgd2VpZ2h0IHN1Y2ggYXMgXFwoa1xcKSBhdHRhY2hlZCB0byBpdC4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGlzIGlzIGFuIG9yZGluYXJ5IGdlb21ldHJpYyBzZXJpZXMsIG5vdCB3ZWlnaHRlZC4iLCJCIjoiVGhpcyBpcyB0aGUgc3RhbmRhcmQgc3VtIG9mIGludGVnZXJzLiIsIkMiOiJUaGlzIGlzIHRoZSBzdGFuZGFyZCBzdW0gb2Ygc3F1YXJlcy4ifSwiaGludCI6IkZpbmQgdGhlIG9wdGlvbiB3aGVyZSBcXChrXFwpIG11bHRpcGxpZXMgYSBwb3dlciB0ZXJtLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoiZ2VvbWV0cmljX2Zvcm11bGFfdXNlIiwibGFiZWwiOiJVc2UgdGhlIGZpbml0ZSBnZW9tZXRyaWMtc2VyaWVzIGZvcm11bGEgY29ycmVjdGx5IiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AyX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJFdmFsdWF0ZSBcXChcXHN1bV97az0xfV57M30gMl5rXFwpLiIsIm9wdGlvbnMiOlsiQS4gNiIsIkIuIDgiLCJDLiAxNCIsIkQuIDE2Il0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiVGhlIHN1bSBpcyBcXCgyICsgNCArIDggPSAxNFxcKS4gVXNpbmcgdGhlIGdlb21ldHJpYyBmb3JtdWxhIHdpdGggXFwocj0yXFwpLCBcXChtPTFcXCksIFxcKG49M1xcKSBnaXZlcyBcXChcXGZyYWN7Ml40IC0gMl4xfXsyLTF9ID0gXFxmcmFjezE2LTJ9ezF9ID0gMTRcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhpcyBtaXNzZXMgdGhlIGV4cG9uZW50aWFsIGdyb3d0aCBhbmQgaXMgdG9vIHNtYWxsLiIsIkIiOiJUaGlzIGlzIG9ubHkgb25lIHRlcm0sIFxcKDJeM1xcKSwgbm90IHRoZSBmdWxsIHN1bS4iLCJEIjoiVGhpcyBpcyBcXCgyXjRcXCksIG5vdCB0aGUgc3VtIG9mIHRlcm1zIGZyb20gXFwoayA9IDFcXCkgdG8gXFwoM1xcKS4ifSwiaGludCI6IllvdSBjYW4gZWl0aGVyIGFkZCB0aGUgdGhyZWUgdGVybXMgZGlyZWN0bHkgb3IgdXNlIHRoZSBmaW5pdGUgZ2VvbWV0cmljIGZvcm11bGEuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50IjpmYWxzZX0seyJpZCI6ImtwMl9xMiIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiSW4gdGhlIGZvcm11bGEgXFwoXFxzdW1fe2s9bX1ee259IHJeayA9IFxcZnJhY3tyXntuKzF9LXJebX17ci0xfVxcKSwgd2hpY2ggY29uZGl0aW9uIG11c3QgYmUgY2hlY2tlZCBiZWZvcmUgdXNpbmcgaXQ/Iiwib3B0aW9ucyI6WyJBLiBcXChuIFxcbmUgMFxcKSIsIkIuIFxcKG0gXFxuZSAwXFwpIiwiQy4gXFwociBcXG5lIDFcXCkiLCJELiBcXChyIFxcbmUgMFxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkMiLCJleHBsYW5hdGlvbiI6IlRoZSBkZW5vbWluYXRvciBpcyBcXChyLTFcXCksIHNvIHRoZSBmb3JtdWxhIGJyZWFrcyBpZiBcXChyID0gMVxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGUgZm9ybXVsYSBjYW4gc3RpbGwgYmUgdXNlZCB3aXRoIFxcKG4gPSAwXFwpLCBkZXBlbmRpbmcgb24gdGhlIGJvdW5kcy4iLCJCIjoiVGhlIGxvd2VyIGxpbWl0IGRvZXMgbm90IG5lZWQgdG8gYmUgbm9uemVyby4iLCJEIjoiVGhlIGZvcm11bGEgY2FuIHN0aWxsIGJlIHZhbGlkIHdoZW4gXFwociA9IDBcXCksIGFzIGxvbmcgYXMgdGhlIHRlcm1zIG1ha2Ugc2Vuc2UuIn0sImhpbnQiOiJMb29rIGZvciB0aGUgdmFsdWUgdGhhdCB3b3VsZCBtYWtlIHRoZSBkZW5vbWluYXRvciB6ZXJvLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoic3RhbmRhcmRfc3VtX2Zvcm11bGFzIiwibGFiZWwiOiJSZWNhbGwgdGhlIHN0YW5kYXJkIGZvcm11bGFzIGZvciBzdW1zIG9mIGsgYW5kIGsgc3F1YXJlZCIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJtZWRpdW0iLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjF9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AzX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGljaCBmb3JtdWxhIGlzIGNvcnJlY3Q/Iiwib3B0aW9ucyI6WyJBLiBcXChcXHN1bV97az0wfV57bn0gayA9IFxcZnJhY3tuKG4tMSl9ezJ9XFwpIiwiQi4gXFwoXFxzdW1fe2s9MH1ee259IGsgPSBcXGZyYWN7bihuKzEpfXsyfVxcKSIsIkMuIFxcKFxcc3VtX3trPTB9XntufSBrXjIgPSBcXGZyYWN7bihuKzEpfXsyfVxcKSIsIkQuIFxcKFxcc3VtX3trPTB9XntufSBrXjIgPSBcXGZyYWN7bihuKzEpKDJuLTEpfXs2fVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IlRoZSBzdGFuZGFyZCBmb3JtdWxhIGlzIFxcKFxcc3VtX3trPTB9XntufSBrID0gXFxmcmFje24obisxKX17Mn1cXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhpcyBpcyBhIGNvbW1vbiBvZmYtYnktb25lIG1pc3Rha2Ug4oCUIHRoZSBjb3JyZWN0IGZhY3RvciBpcyBcXCgobisxKVxcKSwgbm90IFxcKChuLTEpXFwpLiIsIkMiOiJUaGF0IGlzIHRoZSBmb3JtdWxhIGZvciBcXChcXHN1bSBrXFwpLCBub3QgXFwoXFxzdW0ga14yXFwpLiIsIkQiOiJUaGUgY29ycmVjdCBzcXVhcmUgZm9ybXVsYSB1c2VzIFxcKDJuKzFcXCksIG5vdCBcXCgybi0xXFwpLiJ9LCJoaW50IjoiT25lIGZvcm11bGEgaXMgdGhlIGxpbmVhciBzdW07IHRoZSBvdGhlciBpbmNsdWRlcyB0aGUgZmFjdG9yIFxcKDJuKzFcXCkuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50IjpmYWxzZX0seyJpZCI6ImtwM19xMiIsInR5cGUiOiJzaG9ydF9hbnN3ZXIiLCJzdGVtIjoiQ29tcHV0ZSBcXChcXHN1bV97az0wfV57NH0ga14yXFwpIHVzaW5nIHRoZSByZWZlcmVuY2UgZm9ybXVsYS4iLCJpZGVhbF9hbnN3ZXIiOiJVc2UgXFwoXFxzdW1fe2s9MH1ee259IGteMiA9IFxcZnJhY3tuKG4rMSkoMm4rMSl9ezZ9XFwpLiBXaXRoIFxcKG4gPSA0XFwpLCB0aGUgc3VtIGlzIFxcKFxcZnJhY3s0IFxcY2RvdCA1IFxcY2RvdCA5fXs2fSA9IFxcZnJhY3sxODB9ezZ9ID0gMzBcXCkuIiwiZ3JhZGluZ19ydWJyaWMiOlsiTXVzdCB1c2UgdGhlIHNxdWFyZS1zdW0gZm9ybXVsYSwgbm90IHRoZSBsaW5lYXItc3VtIGZvcm11bGEiLCJNdXN0IHN1YnN0aXR1dGUgXFwobiA9IDRcXCkgY29ycmVjdGx5IiwiTXVzdCByZWFjaCB0aGUgZmluYWwgdmFsdWUgMzAiXSwiZXhwbGFuYXRpb24iOiJUaGlzIGNoZWNrcyB3aGV0aGVyIHRoZSBzdHVkZW50IGNhbiBkaXN0aW5ndWlzaCB0aGUgc3F1YXJlIGZvcm11bGEgZnJvbSB0aGUgc2ltcGxlciBzdW0gb2YgaW50ZWdlcnMgZm9ybXVsYS4iLCJoaW50IjoiVGhlIGNvcnJlY3QgZm9ybXVsYSBpbmNsdWRlcyB0aGUgZmFjdG9yIFxcKDJuKzFcXCkuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50IjpmYWxzZX1dfV19" style="display:none;"></div>%%KC_END%%
