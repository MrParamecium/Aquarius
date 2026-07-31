# 2.4-2 Graphical Understanding of Convolution

> **Section objective:** Understand why convolution adds contributions from the past, turn the integral into a five-step graphical procedure, and use Figure 2.7 to connect overlap area with the output of an LTIC system.

Concepts in this section:

- System memory and accumulated past contributions
- The roles of t and τ
- The four graphical actions from flipping through integration
- The five-step graphical procedure
- Figure 2.7 and first contact
- Convolution in LTIC systems

## 1. Why Convolution Adds the Past

A system with memory does not forget an input as soon as that input ends. A tiny part of the input applied at a past time τ leaves behind a scaled and delayed system response. The output we see now is the sum of all those responses that are still present.

Imagine a transparent pool. Instead of pouring in one bucket of ink, you add drops at many different times. Each drop is darkest when it enters. As time passes, it spreads through the water and becomes fainter. The color of the pool now is not caused by the last drop alone. It is the combined color still left by every earlier drop.

Convolution keeps that same kind of total:

- \(x(\tau)\) tells us how much ink was added at the past time τ.
- \(g(t-\tau)\) tells us how much influence that drop still has after an age of \(t-\tau\).
- \(x(\tau)g(t-\tau)\) is that one drop's contribution to the output now.
- The integral adds the contributions from every possible past time.

This is the central reason convolution appears in systems: each small input contribution creates a response, and linearity lets us add all of those responses.

## 2. What the Integral Is Saying

The convolution of \(x(t)\) and \(g(t)\) is

$$
c(t)=\int_{-\infty}^{\infty}x(\tau)g(t-\tau)\,d\tau.
$$

To calculate one value \(c(t)\), hold \(t\) fixed. It means "now." The variable τ is the one that scans through the past.

Think of pinning today's date on a calendar while your finger moves backward across earlier dates. For each date τ, you ask two questions: how much input occurred then, and how much of its effect survives until today? Their product is one historical contribution. The integral is the total of all such contributions.

That is why both \(x(\tau)\) and \(g(t-\tau)\) must be drawn against the same horizontal τ-axis. The picture changes when we choose another value of \(t\), but each individual area calculation is performed along τ.

## 3. How the Graphical Procedure Works

Now imagine that \(x(\tau)\) is a farm spread along the τ-axis. Crop density changes from one location to another. Imagine \(g\) as the spray pattern of a sprinkler truck. We want to know how much useful water the whole farm receives when the truck is positioned at \(t\).

First the sprinkler truck turns around. This is the reflection from \(g(\tau)\) to \(g(-\tau)\). Then it drives along the farm to position \(t\). This is the shift from \(g(-\tau)\) to \(g(t-\tau)\).

At each location, the useful contribution is

$$
\text{crop density}\times\text{local spray amount}.
$$

Sparse crops under heavy spray still make only a limited contribution. Dense crops under a tiny spray also make only a small contribution. This is why overlap width alone is not enough: we must multiply the two heights point by point. Adding those local contributions over the whole farm gives \(c(t)\).

The graphical actions therefore come directly from the formula:

- **Flip and slide:** these actions construct \(g(t-\tau)\).
- **Multiply:** this finds the contribution at each τ.
- **Integrate:** this adds all local contributions into one output value.

## 4. Five-Step Checklist

Use the same checklist whenever you perform graphical convolution:

1. **Fix:** Draw both signals on the τ-axis and keep \(x(\tau)\) fixed.
2. **Flip:** Reflect the simpler signal about \(\tau=0\).
3. **Slide:** Shift the flipped signal by \(t_0\) to form \(g(t_0-\tau)\).
4. **Multiply and find area:** Identify the overlap, multiply the heights, and integrate. The area is \(c(t_0)\).
5. **Record and scan:** Plot that value at \(t=t_0\), change \(t_0\), and repeat to build the complete \(c(t)\).

Convolution is commutative, so you may choose which signal to flip. A useful rule is to flip the signal whose shape is simpler.

## 5. Figure 2.7 in GeoGebra

The textbook signals are

$$
x(\tau)=u(\tau+1),\qquad g(\tau)=2e^{-(\tau+2)}u(\tau+2).
$$

The step \(x(\tau)\) begins at \(\tau=-1\). After \(g(\tau)\) is flipped and shifted,

$$
g(t-\tau)=2e^{\tau-t-2}u(t+2-\tau),
$$

so its moving right boundary is \(\tau=t+2\).

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="interactive_demo" data-teaching-role="concept_anchor" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoZSBmb3VyLXN0ZXAgdmlldyB0byBtZW1vcml6ZSBmbGlwLCBzbGlkZSwgbXVsdGlwbHksIGludGVncmF0ZS4iLCJzdGFuZGFyZCI6IlRyYWNrIHRoZSBtb3Zpbmcgc3VwcG9ydCBib3VuZGFyeSBhbmQgY29ubmVjdCBvdmVybGFwIGFyZWEgdG8gYyh0KS4iLCJ0b3Bfc2NvcmUiOiJWZXJpZnkgZmlyc3QgY29udGFjdCBhbmQgdGhlIHBpZWNld2lzZSBvdXRwdXQgYXQgc2V2ZXJhbCB0IHZhbHVlcy4ifQ==" style="display:none;"></div><div class="kc-interactive-demo" data-demo-b64="eyJ0eXBlIjoiaW50ZXJhY3RpdmVfZGVtbyIsImRlbW9fdHlwZSI6Imdlb2dlYnJhX2NvbnZvbHV0aW9uIiwidGl0bGUiOiJHcmFwaGljYWwgY29udm9sdXRpb246IGZsaXAsIHNsaWRlLCBhbmQgaW50ZWdyYXRlIiwiZXhwbGFuYXRpb24iOiJGb2xsb3cgRmlndXJlIDIuNyBpbiBvbmUgY29udGludW91cyBjb25zdHJ1Y3Rpb24uIE1vdmUgdCB3aGlsZSBHZW9HZWJyYSBrZWVwcyB0aGUgZmxpcHBlZCBzaWduYWwsIG92ZXJsYXAgYXJlYSwgYW5kIG91dHB1dCBwb2ludCBzeW5jaHJvbml6ZWQuIiwidGVhY2hpbmdfcm9sZSI6ImNvbmNlcHRfYW5jaG9yIiwic3BlYyI6eyJmcmFtZXdvcmsiOiJnZW9nZWJyYSIsInNjZW5lIjoiY29udm9sdXRpb25fZmlndXJlXzJfNyIsImd1aWRhbmNlIjoic29mdCIsImluaXRpYWxfc3RlcCI6MSwiaW5pdGlhbF90IjotNCwidF9taW4iOi00LCJ0X21heCI6MywidF9zdGVwIjowLjA1LCJ0YXJnZXRfdCI6LTMsInRhcmdldF90b2xlcmFuY2UiOjAuMDgsImZhbGxiYWNrX2ZpZ3VyZSI6Ii9maWd1cmVzL3BhZ2UtMTc5LWZpZ3VyZV8yXzcucG5nIn19"></div>%%KC_END%%

The two factors overlap only when

$$
\tau\ge -1\qquad\text{and}\qquad \tau\le t+2.
$$

First contact occurs when the two boundaries meet:

$$
t+2=-1\quad\Longrightarrow\quad t=-3.
$$

At \(t=-3\), the signals touch at one point. A point has zero width, so the overlap area and \(c(-3)\) are still zero.

For \(t>-3\), the overlap interval is \([-1,t+2]\), and

$$
\begin{aligned}
c(t)
&=\int_{-1}^{t+2}2e^{\tau-t-2}\,d\tau\\
&=2\left(1-e^{-(t+3)}\right).
\end{aligned}
$$

Thus

$$
c(t)=
\begin{cases}
0, & t\le -3,\\
2\left(1-e^{-(t+3)}\right), & t>-3.
\end{cases}
$$

Use these checkpoints while dragging the slider:

$$
c(-2)=2(1-e^{-1})\approx1.2642,\qquad
c(0)=2(1-e^{-3})\approx1.9004.
$$

Do not confuse the product height with the output. The output is the entire shaded area. Also remember to flip before sliding; shifting \(g(\tau)\) first creates the wrong moving signal.

## 6. Why This Section Matters in the Book

This subsection belongs to Section 2.4, **System Response to External Input: The Zero-State Response**. For an LTIC system with input \(x(t)\) and impulse response \(h(t)\),

$$
y(t)=x(t)*h(t).
$$

Convolution is therefore a general machine for answering: if we know the input and the system, what output will the system produce?

- **Earlier in Section 2.4:** Example 2.9 uses convolution to find the loop current of an RLC circuit. Once the impulse response is known, a new input does not require solving the differential equation again from the beginning.
- **Sampling and filtering:** The textbook explicitly notes that graphical convolution helps us predict results in sampling, filtering, and cases where signals are known mainly by their graphs.
- **Next in Section 2.4-3:** Two LTIC subsystems in cascade have the combined impulse response \(h_1(t)*h_2(t)\). The graphical skill learned here makes that result meaningful rather than merely symbolic.

**Key takeaway:** Convolution is not a ritual of moving two curves. It asks how much influence every past piece of the input still has now, and then adds all of those influences to produce the current output.
