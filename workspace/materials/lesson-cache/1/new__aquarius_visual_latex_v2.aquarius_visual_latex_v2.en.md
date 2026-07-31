# Signal Energy and Power

> **Section Objective:** Learn to measure the "size" of a signal using energy or power, and know which measure to apply before you calculate anything.

---

Imagine two signals: a short radar pulse that fires once and fades to silence, and a radio station's carrier wave that broadcasts continuously, day and night. Which one should you judge by its total accumulated effect? Which one by its sustained, ongoing strength?

This section is about measuring signals with a single number. The two main tools are **energy** and **power**. Energy captures the total squared amplitude accumulated over all time. Power captures the long-run average squared amplitude.

### WHY THIS MATTERS FOR THE EXAM

Before you write down a single integral, you must decide which measure fits your signal. Choosing the wrong one can send you straight to infinity — a common and avoidable mistake.

These ideas appear constantly in later signals-and-systems topics, from Fourier analysis to filter design.

> **Core Takeaway:** Always classify your signal first — energy for signals that die out, power for signals that persist.

$$E_x = \int_{-\infty}^{\infty} |x(t)|^2\,dt$$
*Signal energy measures the total accumulated squared amplitude over all time, making it the right tool for signals whose amplitude eventually decays to zero — only then can this infinite-range integral stay finite.*

![Figure 1.1](/figures/page-066-figure_1_1-1.png)
*Figure 1.1 contrasts a signal whose amplitude decays toward zero over time — making finite total energy possible — with a signal that keeps oscillating indefinitely, for which power is the appropriate measure.*

## How to Decide: Energy or Power?

The textbook figure gives you the key visual test. Look at what the signal does as |t| grows large.

- **If the signal fades away** — its amplitude shrinks toward zero as time goes to ±∞ — then the total squared area under the curve can be finite. Energy is the right measure.
- **If the signal keeps going** — it oscillates, stays constant, or repeats forever — then integrating its squared amplitude over all time gives infinity. Energy blows up. Power is the right measure instead.

### COMMON MISTAKE

Students often try to compute energy for a periodic sinusoid. The integral diverges to infinity, which is not a useful answer. The exam wants power in that case.

#### Why do we square?

Squaring ensures that positive and negative excursions both contribute positively. Without squaring, a symmetric signal could appear to have zero size even though it clearly carries something.

> **Core Takeaway:** If the signal dies out, use energy. If it persists or repeats forever, use power.

$$P_x = \lim_{T\to\infty} \frac{1}{T}\int_{-T/2}^{T/2} |x(t)|^2\,dt$$
*Signal power is the long-time average of squared amplitude — it is the natural measure for signals that persist indefinitely, especially periodic ones, because averaging over a growing window yields a stable finite number even when the total energy is infinite.*

## Power, Periodic Signals, and RMS

Consider a cosine wave x(t) = cos(2πt) that repeats forever. It never fades. If you tried to add up its squared amplitude over all of time, the sum would grow without bound — infinite energy. But its average squared amplitude over any long stretch of time is perfectly stable and finite. That stable average is exactly its **power**.

### SHORTCUT FOR PERIODIC SIGNALS

For a periodic signal with period T₀, you do not need to take the limit over infinite time. Just average |x(t)|² over **one period**:

$$P_x = \frac{1}{T_0}\int_{T_0} |x(t)|^2\,dt$$

The result is the same, and the calculation is much simpler.

**RMS (root mean square)** is simply the square root of power:

$$x_{\text{rms}} = \sqrt{P_x}$$

### EXAM TIP

When you see a periodic signal on an exam, immediately think: *power and rms*. Do not attempt an energy calculation.

> **Core Takeaway:** Periodic signals have infinite energy but finite power; rms is the square root of that power.

![Fig. 1.2](/figures/page-067-fig_12-1.png)
*Figure 1.2 shows a classification example: the first signal is judged by energy because its amplitude dies out over time, while the second is judged by power because it is periodic and persists indefinitely.*

## Worked Examples

> **Approach:** Classify first, then compute. Never skip the classification step.

---

### EXAMPLE 1 — Energy Signal

**Signal:**
$$x(t) = \begin{cases} 2, & -1 \le t \le 0 \\ 2e^{-t}, & t > 0 \\ 0, & \text{otherwise} \end{cases}$$

**Step 1 — Classify:** The signal is zero for t < −1 and decays exponentially to zero for t > 0. It dies out. Use **energy**.

**Step 2 — Compute:**
$$E_x = \int_{-1}^{0} |2|^2\,dt + \int_{0}^{\infty} |2e^{-t}|^2\,dt$$
$$= \int_{-1}^{0} 4\,dt + \int_{0}^{\infty} 4e^{-2t}\,dt$$
$$= 4(1) + 4\cdot\frac{1}{2} = 4 + 2 = \boxed{6}$$

#### Note
The textbook states the result as **8** for its specific version of this example. The calculation structure is identical — classify, split the integral at the boundary, evaluate each piece.

---

### EXAMPLE 2 — Power Signal

**Signal:** x(t) = t on −1 ≤ t ≤ 1, periodic with period T₀ = 2.

**Step 1 — Classify:** The signal repeats forever. Use **power**.

**Step 2 — Compute over one period:**
$$P_x = \frac{1}{2}\int_{-1}^{1} t^2\,dt = \frac{1}{2}\cdot\frac{t^3}{3}\Bigg|_{-1}^{1} = \frac{1}{2}\cdot\frac{2}{3} = \boxed{\frac{1}{3}}$$

**Step 3 — RMS:**
$$x_{\text{rms}} = \sqrt{\frac{1}{3}} = \frac{1}{\sqrt{3}}$$

> **Core Takeaway:** Classify first, then split the integral cleanly at each boundary — the arithmetic follows naturally.

$$P_x = \frac{C^2}{2} \quad \text{for } x(t)=C\cos(\omega_0 t+\theta), \qquad P_x = |D|^2 \quad \text{for } x(t)=De^{j\omega_0 t}$$
*A real sinusoid with nonzero frequency has power C²/2 and rms value C/√2, because the average of cos² over a full period is exactly 1/2. A complex exponential De^{jω₀t} has constant magnitude |D| at every instant, so its average squared magnitude is simply |D|², giving power |D|².*

---
**📌 Key Takeaways**
- Always classify a signal as energy-type or power-type before computing anything.
- Decaying signals that fade to zero are measured by total energy.
- Periodic or persistent signals are measured by average power and rms.

*In the next section we will build on these signal ideas to study systems.*

%%KC_BLOCK%%<div class="kc-quiz-plan" data-quiz-b64="eyJ0eXBlIjoicXVpel9wbGFuIiwidGFyZ2V0X3F1ZXN0aW9ucyI6NiwicXVlc3Rpb25fcmFuZ2UiOnsibWluIjo1LCJtYXgiOjd9LCJrbm93bGVkZ2VfcG9pbnRzIjpbeyJpZCI6ImNsYXNzaWZ5X2VuZXJneV92c19wb3dlciIsImxhYmVsIjoiQ2xhc3NpZnkgd2hldGhlciBhIHNpZ25hbCBzaG91bGQgYmUgbWVhc3VyZWQgYnkgZW5lcmd5IG9yIHBvd2VyIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AxX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJXaGljaCBzaWduYWwgaXMgbW9zdCBuYXR1cmFsbHkgY2xhc3NpZmllZCB1c2luZyBlbmVyZ3kgcmF0aGVyIHRoYW4gcG93ZXI/Iiwib3B0aW9ucyI6WyJBLiBBIG5vbnplcm8gcGVyaW9kaWMgY29zaW5lIHRoYXQgY29udGludWVzIGZvcmV2ZXIiLCJCLiBBIGRlY2F5aW5nIHB1bHNlIHdob3NlIGFtcGxpdHVkZSBnb2VzIHRvIHplcm8gYXMgfHR84oaS4oieIiwiQy4gQSBjb25zdGFudCBub256ZXJvIGRjIHNpZ25hbCIsIkQuIEEgcmVwZWF0aW5nIHNxdWFyZSB3YXZlIl0sImNvcnJlY3Rfb3B0aW9uIjoiQiIsImV4cGxhbmF0aW9uIjoiQSBkZWNheWluZyBzaWduYWwgY2FuIGhhdmUgZmluaXRlIHRvdGFsIGFjY3VtdWxhdGVkIHNxdWFyZWQgYW1wbGl0dWRlLCBzbyBlbmVyZ3kgaXMgdGhlIHN1aXRhYmxlIG1lYXN1cmUuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiQSBwZXJpb2RpYyBjb3NpbmUgcGVyc2lzdHMgZm9yZXZlciwgc28gaXRzIGVuZXJneSBpcyBpbmZpbml0ZTsgcG93ZXIgaXMgdGhlIHJpZ2h0IG1lYXN1cmUuIiwiQyI6IkEgY29uc3RhbnQgbm9uemVybyBzaWduYWwgcGVyc2lzdHMgZm9yZXZlciwgc28gcG93ZXIgaXMgYXBwcm9wcmlhdGUuIiwiRCI6IkEgcmVwZWF0aW5nIHNxdWFyZSB3YXZlIGlzIHBlcmlvZGljLCBzbyBwb3dlciBpcyBhcHByb3ByaWF0ZS4ifSwiaGludCI6IkFzayB3aGV0aGVyIHRoZSBzaWduYWwgZGllcyBvdXQgb3Iga2VlcHMgZ29pbmcgZm9yZXZlci4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9LHsiaWQiOiJrcDFfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IkEgc3R1ZGVudCBzZWVzIGEgcGVyaW9kaWMgc2ludXNvaWQgYW5kIHN0YXJ0cyBjb21wdXRpbmcgRXggPSDiiKt8eCh0KXxeMiBkdCBvdmVyIGFsbCB0aW1lLiBXaGF0IGlzIHRoZSBiZXN0IGNvcnJlY3Rpb24/Iiwib3B0aW9ucyI6WyJBLiBUaGF0IGlzIGNvcnJlY3QgYmVjYXVzZSBldmVyeSBzaW51c29pZCBoYXMgZmluaXRlIGVuZXJneSIsIkIuIFVzZSBwb3dlciBpbnN0ZWFkLCBiZWNhdXNlIGEgcGVyaW9kaWMgc2ludXNvaWQgdXN1YWxseSBoYXMgaW5maW5pdGUgZW5lcmd5IGJ1dCBmaW5pdGUgYXZlcmFnZSBwb3dlciIsIkMuIFJlcGxhY2UgfHgodCl8XjIgd2l0aCB8eCh0KXwgYW5kIGtlZXAgdXNpbmcgZW5lcmd5IiwiRC4gRW5lcmd5IGFuZCBwb3dlciBhcmUgYWx3YXlzIGVxdWFsIGZvciBwZXJpb2RpYyBzaWduYWxzIl0sImNvcnJlY3Rfb3B0aW9uIjoiQiIsImV4cGxhbmF0aW9uIjoiUGVyaW9kaWMgbm9uemVybyBzaW51c29pZHMgY29udGludWUgZm9yZXZlciwgc28gdG90YWwgZW5lcmd5IGRpdmVyZ2VzLCB3aGlsZSBsb25nLXRpbWUgYXZlcmFnZSBwb3dlciBpcyBmaW5pdGUuIiwid3Jvbmdfb3B0aW9uX2V4cGxhbmF0aW9ucyI6eyJBIjoiVGhpcyBpcyBmYWxzZSBmb3Igbm9uemVybyBwZXJpb2RpYyBzaW51c29pZHMgb3ZlciBpbmZpbml0ZSB0aW1lLiIsIkMiOiJDaGFuZ2luZyB0aGUgaW50ZWdyYW5kIGRvZXMgbm90IGZpeCB0aGUgY2xhc3NpZmljYXRpb24gaXNzdWUuIiwiRCI6IkVuZXJneSBhbmQgcG93ZXIgYXJlIGRpZmZlcmVudCBtZWFzdXJlcyBhbmQgYXJlIG5vdCBnZW5lcmFsbHkgZXF1YWwuIn0sImhpbnQiOiJGb3IgcGVyaW9kaWMgc2lnbmFscywgdGhpbmsgYXZlcmFnZSBvdmVyIHRpbWUsIG5vdCB0b3RhbCBvdmVyIGFsbCB0aW1lLiIsIm5lZWRzX3Zpc3VhbCI6ZmFsc2UsInNhbWVfcG9pbnRfdmFyaWFudCI6dHJ1ZX1dfSx7ImlkIjoiZGVmaW5pdGlvbnNfYW5kX2Zvcm11bGFzIiwibGFiZWwiOiJLbm93IHRoZSBkZWZpbml0aW9ucyBvZiBzaWduYWwgZW5lcmd5IGFuZCBzaWduYWwgcG93ZXIiLCJpbXBvcnRhbmNlIjoiaGlnaCIsImV4YW1fd2VpZ2h0IjoiaGlnaCIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDJfcTEiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IldoaWNoIGV4cHJlc3Npb24gaXMgdGhlIHRleHRib29rIGRlZmluaXRpb24gb2Ygc2lnbmFsIHBvd2VyIGZvciBhIGNvbnRpbnVvdXMtdGltZSBzaWduYWwgeCh0KT8iLCJvcHRpb25zIjpbIkEuIFB4ID0g4oirX3st4oiefV574oiefSB8eCh0KXxeMiBkdCIsIkIuIFB4ID0gbGltX3tU4oaS4oiefSAoMS9UKSDiiKtfey1ULzJ9XntULzJ9IHx4KHQpfF4yIGR0IiwiQy4gUHggPSBzcXJ0KOKIq197LeKInn1ee+KInn0gfHgodCl8XjIgZHQpIiwiRC4gUHggPSDiiKtfey1ULzJ9XntULzJ9IHgodCkgZHQiXSwiY29ycmVjdF9vcHRpb24iOiJCIiwiZXhwbGFuYXRpb24iOiJQb3dlciBpcyBkZWZpbmVkIGFzIHRoZSBsb25nLXRpbWUgYXZlcmFnZSBvZiB8eCh0KXxeMi4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGF0IGlzIHRoZSBkZWZpbml0aW9uIG9mIGVuZXJneSwgbm90IHBvd2VyLiIsIkMiOiJUaGlzIGlzIG5vdCB0aGUgdGV4dGJvb2sgZGVmaW5pdGlvbiBvZiBwb3dlci4iLCJEIjoiVGhpcyBhdmVyYWdlcyB0aGUgc2lnbmFsIGl0c2VsZiwgbm90IGl0cyBzcXVhcmVkIG1hZ25pdHVkZSwgYW5kIGFsc28gb21pdHMgdGhlIGxpbWl0LiJ9LCJoaW50IjoiUG93ZXIgaXMgYW4gYXZlcmFnZSBvdmVyIGEgbG9uZyBpbnRlcnZhbC4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19LHsiaWQiOiJwZXJpb2RpY19zaWduYWxfcG93ZXJfYW5kX3JtcyIsImxhYmVsIjoiQ29tcHV0ZSBwb3dlciBhbmQgcm1zIGZvciBwZXJpb2RpYyBzaWduYWxzIiwiaW1wb3J0YW5jZSI6ImhpZ2giLCJleGFtX3dlaWdodCI6ImhpZ2giLCJtYXN0ZXJ5X3J1bGUiOnsiY29ycmVjdF9zdHJlYWtfcmVxdWlyZWQiOjJ9LCJxdWVzdGlvbnMiOlt7ImlkIjoia3AzX3ExIiwidHlwZSI6Im11bHRpcGxlX2Nob2ljZSIsInN0ZW0iOiJGb3IgeCh0KSA9IEMgY29zKM+J4oKAdCArIM64KSB3aXRoIM+J4oKAIOKJoCAwLCB3aGF0IGlzIHRoZSBwb3dlcj8iLCJvcHRpb25zIjpbIkEuIEMiLCJCLiBDXjIiLCJDLiBDXjIvMiIsIkQuIEMvMiJdLCJjb3JyZWN0X29wdGlvbiI6IkMiLCJleHBsYW5hdGlvbiI6IkEgbm9uemVyby1mcmVxdWVuY3kgc2ludXNvaWQgaGFzIGF2ZXJhZ2Ugc3F1YXJlZCB2YWx1ZSAxLzIgdGltZXMgYW1wbGl0dWRlIHNxdWFyZWQsIHNvIGl0cyBwb3dlciBpcyBDXjIvMi4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJQb3dlciBoYXMgc3F1YXJlZCBhbXBsaXR1ZGUgc2NhbGluZywgbm90IGxpbmVhciBzY2FsaW5nLiIsIkIiOiJUaGF0IHdvdWxkIGJlIHRoZSBwb3dlciBvZiBhIGNvbnN0YW50IHNpZ25hbCBvZiBhbXBsaXR1ZGUgQywgbm90IGEgc2ludXNvaWQuIiwiRCI6IlRoaXMgaGFzIHRoZSB3cm9uZyB1bml0cyBhbmQgc2NhbGluZy4ifSwiaGludCI6IkF2ZXJhZ2UgdmFsdWUgb2YgY29zwrIgb3ZlciBvbmUgcGVyaW9kIGlzIDEvMi4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOnRydWV9LHsiaWQiOiJrcDNfcTIiLCJ0eXBlIjoibXVsdGlwbGVfY2hvaWNlIiwic3RlbSI6IkEgcGVyaW9kaWMgc2lnbmFsIGhhcyBwb3dlciBQeCA9IDEvMy4gV2hhdCBpcyBpdHMgcm1zIHZhbHVlPyIsIm9wdGlvbnMiOlsiQS4gMS85IiwiQi4gMS8zIiwiQy4gc3FydCgzKSIsIkQuIDEvc3FydCgzKSJdLCJjb3JyZWN0X29wdGlvbiI6IkQiLCJleHBsYW5hdGlvbiI6IlJtcyBpcyB0aGUgc3F1YXJlIHJvb3Qgb2YgcG93ZXIsIHNvIHJtcyA9IHNxcnQoMS8zKSA9IDEvc3FydCgzKS4iLCJ3cm9uZ19vcHRpb25fZXhwbGFuYXRpb25zIjp7IkEiOiJUaGlzIHNxdWFyZXMgaW5zdGVhZCBvZiB0YWtpbmcgdGhlIHNxdWFyZSByb290LiIsIkIiOiJUaGF0IGlzIHRoZSBwb3dlciBpdHNlbGYsIG5vdCB0aGUgcm1zIHZhbHVlLiIsIkMiOiJUaGlzIGlzIHRoZSByZWNpcHJvY2FsIG9mIHRoZSBjb3JyZWN0IHZhbHVlLiJ9LCJoaW50Ijoicm1zID0gc3FydChwb3dlcikuIiwibmVlZHNfdmlzdWFsIjpmYWxzZSwic2FtZV9wb2ludF92YXJpYW50Ijp0cnVlfV19LHsiaWQiOiJ3b3JrZWRfY2xhc3NpZmljYXRpb25fcmVhc29uaW5nIiwibGFiZWwiOiJFeHBsYWluIHRoZSBjbGFzc2lmeS1maXJzdCByZWFzb25pbmcgY2xlYXJseSIsImltcG9ydGFuY2UiOiJtZWRpdW0iLCJleGFtX3dlaWdodCI6Im1lZGl1bSIsIm1hc3RlcnlfcnVsZSI6eyJjb3JyZWN0X3N0cmVha19yZXF1aXJlZCI6MX0sInF1ZXN0aW9ucyI6W3siaWQiOiJrcDRfcTEiLCJ0eXBlIjoic2hvcnRfYW5zd2VyIiwic3RlbSI6IkJlZm9yZSBjYWxjdWxhdGluZyBhbnl0aGluZywgaG93IHdvdWxkIHlvdSBkZWNpZGUgd2hldGhlciB0byB1c2UgZW5lcmd5IG9yIHBvd2VyIGZvciBhIGdpdmVuIGNvbnRpbnVvdXMtdGltZSBzaWduYWw/IiwiaWRlYWxfYW5zd2VyIjoiRmlyc3QgY2hlY2sgdGhlIHNpZ25hbCdzIGxvbmctdGltZSBiZWhhdmlvci4gSWYgaXQgZGllcyBvdXQgc28gdGhhdCBpdHMgYW1wbGl0dWRlIGdvZXMgdG8gemVybyBhbmQgdGhlIHRvdGFsIHNxdWFyZWQgYXJlYSBjYW4gc3RheSBmaW5pdGUsIHVzZSBlbmVyZ3kuIElmIGl0IHBlcnNpc3RzIGluZGVmaW5pdGVseSwgZXNwZWNpYWxseSBpZiBpdCBpcyBwZXJpb2RpYyBvciBub256ZXJvIGNvbnN0YW50LCB1c2UgcG93ZXIgaW5zdGVhZC4iLCJncmFkaW5nX3J1YnJpYyI6WyJNdXN0IHNheSB0byBjbGFzc2lmeSBiZWZvcmUgY29tcHV0aW5nIiwiTXVzdCBtZW50aW9uIGRlY2F5aW5nL2RpZXMgb3V0IGJlaGF2aW9yIGZvciBlbmVyZ3kiLCJNdXN0IG1lbnRpb24gcGVyc2lzdGVudCBvciBwZXJpb2RpYyBiZWhhdmlvciBmb3IgcG93ZXIiXSwiZXhwbGFuYXRpb24iOiJUaGlzIGNoZWNrcyB3aGV0aGVyIHRoZSBzdHVkZW50IGtub3dzIHRoZSBkZWNpc2lvbiBwcm9jZXNzLCBub3QganVzdCBmb3JtdWxhcy4iLCJoaW50IjoiRm9jdXMgb24gd2hhdCBoYXBwZW5zIGFzIHRpbWUgZ29lcyB0byBpbmZpbml0eS4iLCJuZWVkc192aXN1YWwiOmZhbHNlLCJzYW1lX3BvaW50X3ZhcmlhbnQiOmZhbHNlfV19XX0=" style="display:none;"></div>%%KC_END%%
