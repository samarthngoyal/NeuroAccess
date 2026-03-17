# NeuroAccess — axe-core Setup

The accessibility audit feature uses **axe-core** to analyse any page for WCAG violations.

## How to enable the audit

1. Download axe-core from the CDN:
   https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js

2. Save it as:
   ```
   Extension/lib/axe.min.js
   ```

3. Reload the extension in chrome://extensions (click the refresh icon).

That's it. The "Run" button in the popup will now run a full WCAG 2.0 AA + best-practice audit.

## What the audit checks
- WCAG 2.0 Level A
- WCAG 2.0 Level AA
- Accessibility best practices

Results show violations (with impact level), passing rules, and items needing manual review.
