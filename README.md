# NeuroAccess

NeuroAccess is a browser extension designed to improve **cognitive accessibility on the web**.  
It helps users with dyslexia, ADHD, autism, low literacy, and elderly users better understand online content by simplifying text and adapting webpage layouts.

---

## Problem

Many websites are designed assuming users can easily process dense text and complex layouts.  
However, people with cognitive differences or reading difficulties often struggle with:

- Complex vocabulary
- Long sentences
- Visual clutter
- Poor contrast and layout design

This makes accessing important information online difficult.

---

## Solution

NeuroAccess is a browser extension that analyzes webpage content and adapts it based on the user's cognitive needs.

The extension can:

- Simplify complex language
- Adjust fonts and spacing
- Reduce visual distractions
- Highlight important information
- Improve readability and contrast

---

## Key Features

- Cognitive Accessibility Score
- Dyslexia Mode
- ADHD Focus Mode
- Elderly Accessibility Mode
- Text Simplification Engine
- Dynamic Webpage Adaptation

---

## Tech Stack

- HTML
- CSS
- JavaScript
- Chrome Extension Manifest V3
- MutationObserver API
- axe-core accessibility engine


---

### Architecture Overview

The NeuroAccess system consists of four main layers:

- **Extension Layer** – The browser interface that interacts directly with webpages.  
- **Audit Engine** – Analyzes the webpage for accessibility issues and cognitive complexity.  
- **Adaptation Modes** – Applies user-selected accessibility transformations.  
- **Backend Services** – Handles optional processing such as advanced text simplification.

This modular architecture allows NeuroAccess to **analyze webpages, calculate accessibility scores, and dynamically adapt content for different cognitive needs.**

## Project Structure

<img width="607" height="1057" alt="image" src="https://github.com/user-attachments/assets/7cbea967-3d7f-4d5e-885e-231f8346d3c9" />

```
