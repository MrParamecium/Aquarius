%%KC_BLOCK%%<div class="kc-visual-plan" data-visual-plan-b64="eyJwcmltYXJ5X2FuY2hvciI6ImdlbmVyYXRlZF9pbWFnZSIsInJhdGlvbmFsZSI6IlRoaXMgc2VjdGlvbiBpcyBhIGZvcm11bGEtcmVmZXJlbmNlIHBhZ2Ugd2l0aCBubyB1c2FibGUgdGV4dGJvb2sgZmlndXJlcy4gQSBjbGVhbiBnZW5lcmF0ZWQgdGVhY2hpbmcgdmlzdWFsIGlzIHRoZSBiZXN0IHdheSB0byBvcmdhbml6ZSB0aGUgZGVyaXZhdGl2ZSBydWxlcyBpbnRvIGEgcmVhZGFibGUgcGF0dGVybiBhbmQgbWFrZSB0aGUgY2hhaW4vcHJvZHVjdC9xdW90aWVudCBzdHJ1Y3R1cmUgdmlzaWJsZS4iLCJjcmFtIjoiVXNlIHRoZSB2aXN1YWwgYXMgYSBmYXN0IHBhdHRlcm4gc2hlZXQ6IHNwb3QgdGhlIGZ1bmN0aW9uIGZhbWlseSwgdGhlbiBhdHRhY2ggdGhlIGNvcnJlY3QgZGVyaXZhdGl2ZSB0ZW1wbGF0ZSBpbW1lZGlhdGVseS4iLCJzdGFuZGFyZCI6IlVzZSB0aGUgdmlzdWFsIHRvIGdyb3VwIGZvcm11bGFzIGJ5IGlkZWEgYW5kIHN1cHBvcnQgb25lIHJlcHJlc2VudGF0aXZlIGV4YW1wbGUgdGhhdCBzaG93cyBob3cgdGhlIHJ1bGVzIGNvbWJpbmUuIiwidG9wX3Njb3JlIjoiVXNlIHRoZSB2aXN1YWwgdG8gaGlnaGxpZ2h0IGxvb2stYWxpa2UgZm9ybXVsYXMsIHNpZ24gbWlzdGFrZXMsIG1pc3NpbmcgY2hhaW4gZmFjdG9ycywgYW5kIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gcHJvZHVjdCBhbmQgcXVvdGllbnQgc3RydWN0dXJlcy4ifQ==" style="display:none;"></div>%%KC_END%%
# Common Derivative Formulas

> **Section Objective:** Build fast, reliable recognition of derivative patterns — not long derivations.

This page is a formula-reference section. The goal is simple: **identify the function type first, then apply the matching rule.** You do not need to re-derive anything here.

Three structural ideas control most problems:

- **Chain rule** — for a function of another function, \(f(u)\)
- **Product rule** — for two functions multiplied, \(uv\)
- **Quotient rule** — for one function divided by another, \(u/v\)

Beyond those, the section covers the core derivative families: **power, logarithmic, exponential, trigonometric,** and **inverse-trigonometric** functions. Learn to match the form first, then recall the formula.

## 1. The structure rules come first

Before reaching for any specific formula, ask: **is this expression combined?** If yes, a structure rule applies.

- **Chain rule** — outer times inner: differentiate \(f(u)\) as \(f'(u)\) multiplied by \(du/dx\)
- **Product rule** — first times derivative of second, plus second times derivative of first: \(u \cdot v' + v \cdot u'\)
- **Quotient rule** — bottom times derivative of top, minus top times derivative of bottom, all over bottom squared

### WORKED EXAMPLE

For \(y = x^2 \sin(3x)\), two functions are multiplied, so use the **product rule** with \(u = x^2\) and \(v = \sin(3x)\):

$$\frac{dy}{dx} = 2x\sin(3x) + x^2 \cdot 3\cos(3x) = 2x\sin(3x) + 3x^2\cos(3x)$$

The factor **3** comes from the chain rule applied to \(\sin(3x)\).

### EXAM TIP

The most common error here is writing \(x^2 \cos(3x)\) and forgetting the factor **3**. Always check for an inner function.

$$\frac{d}{dx}f(u)=f'(u)\frac{du}{dx}$$
*This is the chain rule: differentiate the outer function \(f\) evaluated at \(u\), then multiply by the derivative of the inner expression \(u\) with respect to \(x\).*

$$\frac{d}{dx}(uv)=u\frac{dv}{dx}+v\frac{du}{dx}$$
*This is the product rule: when two functions \(u\) and \(v\) are multiplied together, differentiate each factor in turn while keeping the other fixed, then add the two results.*

$$\frac{d}{dx}\left(\frac{u}{v}\right)=\frac{v\,du/dx-u\,dv/dx}{v^2}$$
*This is the quotient rule: the numerator is always \(v \cdot u' - u \cdot v'\) in that exact order — reversing the order flips the sign and gives the wrong answer.*

## 2. Core derivative families to memorize

Group the formulas by family so your brain can pattern-match quickly.

### POWERS AND LOGS

The **power rule** \(\frac{d}{dx}x^n = nx^{n-1}\) works for any constant exponent. For **logarithms**, a useful fact: \(\frac{d}{dx}\ln(ax) = \frac{1}{x}\) — the constant \(a\) cancels through the chain rule (see the exam note below).

### EXPONENTIALS

\(\frac{d}{dx}e^{bx} = be^{bx}\) and \(\frac{d}{dx}a^{bx} = b(\ln a)\,a^{bx}\). The factor \(b\) is the inner derivative; \(\ln a\) appears only for base \(a \neq e\).

### TRIG

When the inside is \(ax\), a chain factor \(a\) always appears. Example:

$$\frac{d}{dx}[\cos(5x)] = -5\sin(5x)$$

Quick check: what extra factor appears when you differentiate \(\tan(7x)\)? The answer is **7**.

### INVERSE TRIG

The denominator structure changes: \(\sin^{-1}\) and \(\cos^{-1}\) involve \(\sqrt{1-u^2}\), while \(\tan^{-1}\) involves \(1+u^2\). Always square the inner expression.

### EXAM NOTE

\(\frac{d}{dx}\ln(ax) = \frac{1}{x}\), not \(\frac{1}{ax}\). The chain rule gives \(\frac{1}{ax} \cdot a = \frac{1}{x}\) — the constant \(a\) cancels every time.

$$\frac{d}{dx}x^n=nx^{n-1},\quad \frac{d}{dx}\ln(ax)=\frac{1}{x},\quad \frac{d}{dx}e^{bx}=be^{bx}$$
*These three are the highest-frequency patterns in calculus problems: the power rule for polynomials, the logarithm rule where the constant cancels, and the exponential rule where the inner factor \(b\) multiplies the result.*

$$\frac{d}{dx}\sin(ax)=a\cos(ax),\quad \frac{d}{dx}\cos(ax)=-a\sin(ax),\quad \frac{d}{dx}\tan(ax)=\frac{a}{\cos^2(ax)}$$
*Trig derivatives follow the familiar base patterns — sine to cosine, cosine to negative sine, tangent to secant-squared — with the inner factor \(a\) always multiplied in front.*

---
**📌 Key Takeaways**
- Identify the function family first — power, log, trig, or combined — before choosing a formula.
- When expressions are combined, apply structure rules (chain, product, quotient) before formula recall.
- Watch for missing chain factors and sign errors, especially in trig and inverse-trig derivatives.

*In the next section we will use these formulas inside integration formulas and larger calculus problems.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6InN0cnVjdHVyZV9ydWxlcyIsImxhYmVsIjoiQ2hhaW4gcnVsZSwgcHJvZHVjdCBydWxlLCBhbmQgcXVvdGllbnQgcnVsZSIsImltcG9ydGFuY2UiOiJoaWdoIiwiZXhhbV93ZWlnaHQiOiJoaWdoIiwibWFzdGVyeV9ydWxlIjp7ImNvcnJlY3Rfc3RyZWFrX3JlcXVpcmVkIjoyfSwicXVlc3Rpb25zIjpbeyJpZCI6ImtwMV9xMSIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hpY2ggZGVyaXZhdGl2ZSBpcyBjb3JyZWN0IGZvciBcXCh5ID0gKHheMiArIDEpXjVcXCk/Iiwib3B0aW9ucyI6WyJBLiBcXCg1KHheMiArIDEpXjRcXCkiLCJCLiBcXCgxMHgoeF4yICsgMSleNFxcKSIsIkMuIFxcKDV4KHheMiArIDEpXjRcXCkiLCJELiBcXCgxMHgoeF4yICsgMSleNVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IlVzZSB0aGUgY2hhaW4gcnVsZTogZGlmZmVyZW50aWF0ZSB0aGUgb3V0ZXIgcG93ZXIgZmlyc3QgdG8gZ2V0IFxcKDUoeF4yKzEpXjRcXCksIHRoZW4gbXVsdGlwbHkgYnkgdGhlIGRlcml2YXRpdmUgb2YgdGhlIGlubmVyIGV4cHJlc3Npb24gXFwoeF4yICsgMVxcKSwgd2hpY2ggaXMgXFwoMnhcXCkuIFJlc3VsdDogXFwoMTB4KHheMisxKV40XFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoaXMgZGlmZmVyZW50aWF0ZXMgdGhlIG91dGVyIGZ1bmN0aW9uIGNvcnJlY3RseSBidXQgZm9yZ2V0cyB0byBtdWx0aXBseSBieSB0aGUgaW5uZXIgZGVyaXZhdGl2ZSBcXCgyeFxcKS4iLCJDIjoiVGhpcyBpbmNsdWRlcyBcXCh4XFwpIGJ1dCBtaXNzZXMgdGhlIGZ1bGwgaW5uZXIgZGVyaXZhdGl2ZSBmYWN0b3Igb2YgXFwoMlxcKS4iLCJEIjoiVGhlIGV4cG9uZW50IHNob3VsZCBkZWNyZWFzZSBmcm9tIFxcKDVcXCkgdG8gXFwoNFxcKSBhZnRlciBkaWZmZXJlbnRpYXRpb24uIn0sImhpbnQiOiJBcHBseSB0aGUgb3V0ZXIgZGVyaXZhdGl2ZSBmaXJzdCwgdGhlbiBtdWx0aXBseSBieSB0aGUgZGVyaXZhdGl2ZSBvZiB0aGUgaW5zaWRlLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX0seyJpZCI6ImtwMV9xMiIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiRm9yIFxcKHkgPSB4XjIgXFxzaW4oM3gpXFwpLCB3aGljaCBkZXJpdmF0aXZlIGlzIGNvcnJlY3Q/Iiwib3B0aW9ucyI6WyJBLiBcXCgyeFxcc2luKDN4KSArIDN4XjJcXGNvcygzeClcXCkiLCJCLiBcXCgyeFxcc2luKDN4KSArIHheMlxcY29zKDN4KVxcKSIsIkMuIFxcKHheMlxcY29zKDN4KVxcKSIsIkQuIFxcKDJ4XFxzaW4oeCkgKyB4XjJcXGNvcygzeClcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJBIiwiZXhwbGFuYXRpb24iOiJBcHBseSB0aGUgcHJvZHVjdCBydWxlIHRvIFxcKHheMlxcKSBhbmQgXFwoXFxzaW4oM3gpXFwpOiB0aGUgZGVyaXZhdGl2ZSBvZiBcXChcXHNpbigzeClcXCkgYnkgdGhlIGNoYWluIHJ1bGUgaXMgXFwoM1xcY29zKDN4KVxcKSwgZ2l2aW5nIFxcKDJ4XFxzaW4oM3gpICsgM3heMlxcY29zKDN4KVxcKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkIiOiJUaGlzIGFwcGxpZXMgdGhlIHByb2R1Y3QgcnVsZSBjb3JyZWN0bHkgYnV0IG1pc3NlcyB0aGUgY2hhaW4gZmFjdG9yIFxcKDNcXCkgZnJvbSBcXChcXHNpbigzeClcXCkuIiwiQyI6IlRoaXMgZGlmZmVyZW50aWF0ZXMgb25seSBvbmUgZmFjdG9yIGFuZCBpZ25vcmVzIHRoZSBwcm9kdWN0IHJ1bGUgZW50aXJlbHkuIiwiRCI6IlRoaXMgaW5jb3JyZWN0bHkgY2hhbmdlcyBcXChcXHNpbigzeClcXCkgdG8gXFwoXFxzaW4oeClcXCkgaW4gdGhlIGZpcnN0IHRlcm0uIn0sImhpbnQiOiJUd28gZnVuY3Rpb25zIGFyZSBtdWx0aXBsaWVkLCBhbmQgb25lIG9mIHRoZW0gYWxzbyBoYXMgYW4gaW5uZXIgZnVuY3Rpb24g4oCUIHVzZSBib3RoIHByb2R1Y3QgcnVsZSBhbmQgY2hhaW4gcnVsZS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9XX0seyJpZCI6ImNvcmVfZnVuY3Rpb25fZmFtaWxpZXMiLCJsYWJlbCI6IlBvd2VyLCBsb2dhcml0aG1pYywgZXhwb25lbnRpYWwsIHRyaWcsIGFuZCBpbnZlcnNlLXRyaWcgZGVyaXZhdGl2ZXMiLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDJfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGRlcml2YXRpdmUgaXMgY29ycmVjdD8iLCJvcHRpb25zIjpbIkEuIFxcKFxcZnJhY3tkfXtkeH1bXFxsbig0eCldID0gXFxmcmFjezF9ezR4fVxcKSIsIkIuIFxcKFxcZnJhY3tkfXtkeH1bXFxsbig0eCldID0gXFxmcmFjezR9e3h9XFwpIiwiQy4gXFwoXFxmcmFje2R9e2R4fVtcXGxuKDR4KV0gPSBcXGZyYWN7MX17eH1cXCkiLCJELiBcXChcXGZyYWN7ZH17ZHh9W1xcbG4oNHgpXSA9IFxcZnJhY3tcXGxuIDR9e3h9XFwpIl0sImNvcnJlY3Rfb3B0aW9uIjoiQyIsImV4cGxhbmF0aW9uIjoiQnkgdGhlIGNoYWluIHJ1bGUsIFxcKFxcZnJhY3tkfXtkeH1bXFxsbig0eCldID0gXFxmcmFjezF9ezR4fSBcXGNkb3QgNCA9IFxcZnJhY3sxfXt4fVxcKS4gVGhlIGNvbnN0YW50IFxcKDRcXCkgY2FuY2Vscy4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGlzIHN0b3BzIGF0IFxcKFxcZnJhY3sxfXs0eH1cXCkgYW5kIGZvcmdldHMgdG8gbXVsdGlwbHkgYnkgdGhlIGlubmVyIGRlcml2YXRpdmUgXFwoNFxcKS4iLCJCIjoiVGhpcyBtdWx0aXBsaWVzIGJ5IFxcKDRcXCkgYnV0IGRvZXMgbm90IGRpdmlkZSBieSBcXCg0eFxcKSBjb3JyZWN0bHkuIiwiRCI6IlxcKFxcbG4gNFxcKSBhcHBlYXJzIGluIGRlcml2YXRpdmVzIG9mIFxcKGFee2J4fVxcKS10eXBlIGV4cG9uZW50aWFscywgbm90IGluIGxvZ2FyaXRobSBkZXJpdmF0aXZlcy4ifSwiaGludCI6IkRpZmZlcmVudGlhdGUgXFwoXFxsbih1KVxcKSBhcyBcXChcXGZyYWN7MX17dX0gXFxjZG90IHUnXFwpLCB0aGVuIHNpbXBsaWZ5LiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX0seyJpZCI6ImtwMl9xMiIsInR5cGUiOiJtdWx0aXBsZV9jaG9pY2UiLCJzdGVtIjoiV2hhdCBpcyB0aGUgZGVyaXZhdGl2ZSBvZiBcXChcXGNvcyg1eClcXCk/Iiwib3B0aW9ucyI6WyJBLiBcXCgtXFxzaW4oNXgpXFwpIiwiQi4gXFwoNVxcc2luKDV4KVxcKSIsIkMuIFxcKC01XFxzaW4oNXgpXFwpIiwiRC4gXFwoLTVcXGNvcyg1eClcXCkiXSwiY29ycmVjdF9vcHRpb24iOiJDIiwiZXhwbGFuYXRpb24iOiJUaGUgZGVyaXZhdGl2ZSBvZiBcXChcXGNvcyh1KVxcKSBpcyBcXCgtXFxzaW4odSlcXCksIHRoZW4gbXVsdGlwbHkgYnkgXFwodScgPSA1XFwpLCBnaXZpbmcgXFwoLTVcXHNpbig1eClcXCkuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhpcyBoYXMgdGhlIGNvcnJlY3Qgc2lnbiBidXQgZm9yZ2V0cyB0aGUgY2hhaW4gZmFjdG9yIFxcKDVcXCkuIiwiQiI6IlRoaXMgaW5jbHVkZXMgdGhlIGNoYWluIGZhY3RvciBcXCg1XFwpIGJ1dCBoYXMgdGhlIHdyb25nIHNpZ24g4oCUIGNvc2luZSBkaWZmZXJlbnRpYXRlcyB0byBuZWdhdGl2ZSBzaW5lLiIsIkQiOiJUaGUgZGVyaXZhdGl2ZSBvZiBjb3NpbmUgaXMgc2luZSwgbm90IGNvc2luZSBhZ2Fpbi4ifSwiaGludCI6IlJlbWVtYmVyIGJvdGggdGhlIG5lZ2F0aXZlIHNpZ24gYW5kIHRoZSBpbm5lciBkZXJpdmF0aXZlIFxcKDVcXCkuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfSx7ImlkIjoia3AyX3EzIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGljaCBkZXJpdmF0aXZlIGlzIGNvcnJlY3QgZm9yIFxcKHkgPSBcXHRhbl57LTF9KDJ4KVxcKT8iLCJvcHRpb25zIjpbIkEuIFxcKFxcZGZyYWN7MX17MSArIDR4XjJ9XFwpIiwiQi4gXFwoXFxkZnJhY3syfXsxICsgNHheMn1cXCkiLCJDLiBcXChcXGRmcmFjezJ9ezEgKyAyeF4yfVxcKSIsIkQuIFxcKFxcZGZyYWN7LTJ9ezEgKyA0eF4yfVxcKSJdLCJjb3JyZWN0X29wdGlvbiI6IkIiLCJleHBsYW5hdGlvbiI6IkZvciBcXChcXHRhbl57LTF9KHUpXFwpLCB0aGUgZGVyaXZhdGl2ZSBpcyBcXChcXGZyYWN7dSd9ezErdV4yfVxcKS4gSGVyZSBcXCh1ID0gMnhcXCksIHNvIFxcKHUnID0gMlxcKSBhbmQgXFwodV4yID0gNHheMlxcKSwgZ2l2aW5nIFxcKFxcZnJhY3syfXsxKzR4XjJ9XFwpLiIsIndyb25nX29wdGlvbl9leHBsYW5hdGlvbnMiOnsiQSI6IlRoaXMgZm9yZ2V0cyB0aGUgaW5uZXIgZGVyaXZhdGl2ZSBcXCh1JyA9IDJcXCkgaW4gdGhlIG51bWVyYXRvci4iLCJDIjoiXFwodV4yXFwpIHNob3VsZCBiZSBcXCgoMngpXjIgPSA0eF4yXFwpLCBub3QgXFwoMnheMlxcKS4iLCJEIjoiVGhlcmUgaXMgbm8gbmVnYXRpdmUgc2lnbiBpbiB0aGUgZGVyaXZhdGl2ZSBvZiBhcmN0YW5nZW50LiJ9LCJoaW50IjoiVXNlIFxcKHUnXFwpIG92ZXIgXFwoMSArIHVeMlxcKSwgYW5kIHJlbWVtYmVyIHRvIHNxdWFyZSB0aGUgZnVsbCBpbm5lciBleHByZXNzaW9uIFxcKDJ4XFwpLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6ZmFsc2V9LHsiaWQiOiJrcDJfcTQiLCJ0eXBlIjoic2hvcnRfYW5zd2VyIiwic3RlbSI6IkEgc3R1ZGVudCBzYXlzIFxcKFxcZnJhY3tkfXtkeH1bXFxsbihheCldID0gXFxmcmFjezF9e2F4fVxcKS4gV3JpdGUgdGhlIGNvcnJlY3QgZGVyaXZhdGl2ZSBhbmQgZXhwbGFpbiBpbiBvbmUgb3IgdHdvIHNlbnRlbmNlcyB3aHkgdGhlIGNvbnN0YW50IFxcKGFcXCkgZG9lcyBub3QgcmVtYWluIGluIHRoZSBmaW5hbCBhbnN3ZXIuIiwiaWRlYWxfYW5zd2VyIjoiVGhlIGNvcnJlY3QgZGVyaXZhdGl2ZSBpcyBcXChcXGZyYWN7MX17eH1cXCkuIEJ5IHRoZSBjaGFpbiBydWxlLCBcXChcXGZyYWN7ZH17ZHh9W1xcbG4oYXgpXSA9IFxcZnJhY3sxfXtheH0gXFxjZG90IGEgPSBcXGZyYWN7MX17eH1cXCksIHNvIHRoZSBmYWN0b3IgXFwoYVxcKSBjYW5jZWxzIGNvbXBsZXRlbHkuIiwiZ3JhZGluZ19ydWJyaWMiOlsiTXVzdCBzdGF0ZSB0aGUgZmluYWwgZGVyaXZhdGl2ZSBhcyBcXChcXGZyYWN7MX17eH1cXCkiLCJNdXN0IG1lbnRpb24gdGhlIGNoYWluIHJ1bGUiLCJNdXN0IGV4cGxhaW4gdGhhdCB0aGUgZmFjdG9yIFxcKGFcXCkgY2FuY2VscyJdLCJleHBsYW5hdGlvbiI6IlRoaXMgY2hlY2tzIHdoZXRoZXIgdGhlIHN0dWRlbnQgdHJ1bHkgdW5kZXJzdGFuZHMgaG93IGNvbnN0YW50cyBpbnNpZGUgbG9nYXJpdGhtcyBiZWhhdmUgdW5kZXIgZGlmZmVyZW50aWF0aW9uLCByYXRoZXIgdGhhbiBqdXN0IHBhdHRlcm4tbWF0Y2hpbmcgdGhlIGZvcm11bGEuIiwiaGludCI6IlN0YXJ0IGZyb20gXFwoXFxsbih1KVxcKSB3aXRoIFxcKHUgPSBheFxcKSwgZGlmZmVyZW50aWF0ZSwgdGhlbiBzaW1wbGlmeS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19XX0=" style="display:none;"></div>%%KC_END%%
