# 2.4-2 Graphical Understanding of Convolution

> **Section objective:** Read the convolution integral as a repeatable graphical process: express both signals on the integration axis, flip one signal, slide it by (t), and integrate the overlap.

## 1. The variable that moves and the variable that integrates

For the convolution

$$c(t)=\int_{-\infty}^{\infty}x(\tau)g(t-\tau)\,d\tau,$$

the integration is with respect to τ. During one area calculation, (t) acts like a fixed parameter. Therefore both (x(\tau)) and (g(t-\tau)) must be drawn against the same horizontal τ-axis.

This distinction is the foundation of graphical convolution. The picture changes as (t) changes, but every individual overlap area is measured along τ.

## 2. Read Figure 2.7 before moving anything

The textbook example uses the two signals

$$x(\tau)=u(\tau+1), \qquad g(\tau)=e^{-(\tau+2)}u(\tau+2).$$

The unit step in (x(\tau)) starts at τ = -1. The exponential (g(\tau)) starts at τ = -2 and decays to the right.

![Figure 2.7: graphical explanation of the convolution operation](/figures/page-179-figure_2_7.png)

*Figure 2.7 from the textbook: the original signals, the reversed and shifted signal, the overlap area, and the resulting output.*

## 3. Flip, then slide

First reverse (g(\tau)) about the vertical axis:

$$g(-\tau)=e^{\tau-2}u(2-\tau).$$

The reversed exponential is supported on τ <= 2. Then shift that reversed signal by (t):

$$g(t-\tau)=e^{\tau-t-2}u(t+2-\tau).$$

Its moving boundary is τ = t + 2. Positive (t) shifts the reversed signal to the right; negative (t) shifts it to the left.

%%KC_BLOCK%%<div class="kc-visual-meta" data-visual-kind="interactive_demo" data-teaching-role="concept_anchor" data-visual-use-b64="eyJjcmFtIjoiVXNlIHRoZSBmb3VyLXN0ZXAgdmlldyB0byBtZW1vcml6ZSBmbGlwLCBzbGlkZSwgbXVsdGlwbHksIGludGVncmF0ZS4iLCJzdGFuZGFyZCI6IlRyYWNrIHRoZSBtb3Zpbmcgc3VwcG9ydCBib3VuZGFyeSBhbmQgY29ubmVjdCBvdmVybGFwIGFyZWEgdG8gYyh0KS4iLCJ0b3Bfc2NvcmUiOiJWZXJpZnkgZmlyc3QgY29udGFjdCBhbmQgdGhlIHBpZWNld2lzZSBvdXRwdXQgYXQgc2V2ZXJhbCB0IHZhbHVlcy4ifQ==" style="display:none;"></div><div class="kc-interactive-demo" data-demo-b64="eyJ0eXBlIjoiaW50ZXJhY3RpdmVfZGVtbyIsImRlbW9fdHlwZSI6Imdlb2dlYnJhX2NvbnZvbHV0aW9uIiwidGl0bGUiOiJHcmFwaGljYWwgY29udm9sdXRpb246IGZsaXAsIHNsaWRlLCBhbmQgaW50ZWdyYXRlIiwiZXhwbGFuYXRpb24iOiJGb2xsb3cgRmlndXJlIDIuNyBpbiBvbmUgY29udGludW91cyBjb25zdHJ1Y3Rpb24uIE1vdmUgdCB3aGlsZSBHZW9HZWJyYSBrZWVwcyB0aGUgZmxpcHBlZCBzaWduYWwsIG92ZXJsYXAgYXJlYSwgYW5kIG91dHB1dCBwb2ludCBzeW5jaHJvbml6ZWQuIiwidGVhY2hpbmdfcm9sZSI6ImNvbmNlcHRfYW5jaG9yIiwic3BlYyI6eyJmcmFtZXdvcmsiOiJnZW9nZWJyYSIsInNjZW5lIjoiY29udm9sdXRpb25fZmlndXJlXzJfNyIsImd1aWRhbmNlIjoic29mdCIsImluaXRpYWxfc3RlcCI6MSwiaW5pdGlhbF90IjotNCwidF9taW4iOi00LCJ0X21heCI6MywidF9zdGVwIjowLjA1LCJ0YXJnZXRfdCI6LTMsInRhcmdldF90b2xlcmFuY2UiOjAuMDgsImZhbGxiYWNrX2ZpZ3VyZSI6Ii9maWd1cmVzL3BhZ2UtMTc5LWZpZ3VyZV8yXzcucG5nIn19"></div>%%KC_END%%

The four steps are soft guidance. You may move forward or backward at any time, and the same value of (t) is preserved when you change steps.

## 4. First contact determines the output support

The two factors can overlap only when their supports intersect:

$$\tau \ge -1 \quad\text{and}\quad \tau \le t+2.$$

The first possible contact is therefore

$$-1=t+2 \quad\Longrightarrow\quad t=-3.$$

For (t<-3), there is no overlap and (c(t)=0). At (t=-3), the two supports touch at one point, which still has zero area.

## 5. Integrate the overlap

When (t\ge -3), the overlap interval is ([-1,t+2]). On that interval, (x(\tau)=1), so

$$\begin{aligned}
c(t)
&=\int_{-1}^{t+2}e^{\tau-t-2}\,d\tau \\
&=1-e^{-(t+3)}.
\end{aligned}$$

Hence the complete output is

$$
c(t)=
\begin{cases}
0, & t<-3,\\
1-e^{-(t+3)}, & t\ge -3.
\end{cases}
$$

Two useful checks are

$$c(-2)=1-e^{-1}\approx0.6321, \qquad c(0)=1-e^{-3}\approx0.9502.$$

## Common errors

- Drawing (g(t-\tau)) as a function of (t) while evaluating the integral. The graph must use τ as its horizontal variable.
- Shifting before reversing. Start from (g(\tau)), form (g(-\tau)), and only then shift by (t).
- Reversing the exponential's support in the wrong direction. Here (g(-\tau)) is supported on τ <= 2.
- Treating first contact as positive area. A single touching point has zero width, so (c(-3)=0).
- Reading the product height as the output. The output value is the entire area under (x(\tau)g(t-\tau)).

---

**Key takeaway:** graphical convolution is one continuous loop: put both signals on the τ-axis, flip (g), slide it by (t), multiply where the supports overlap, and record the overlap area as (c(t)).
