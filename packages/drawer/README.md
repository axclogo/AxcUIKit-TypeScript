# Drawer

A controlled right-side modal with a pinned title and close button, one scrollable body and an optional pinned footer. Import the stylesheet once.

```tsx
import { useState } from 'react';
import { Drawer } from '@axclogo/uikit/drawer';
import '@axclogo/uikit/drawer/styles.css';

export function Details() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				View details
			</button>
			<Drawer open={open} size="medium" title="Document" onClose={() => setOpen(false)}>
				<p>Document details</p>
			</Drawer>
		</>
	);
}
```

Use `headerActions` for actions beside the title and `footer` for bottom actions. Omit the footer to give the body the remaining height. Set `closeLabel` for a localized accessible name. Small and medium occupy half and two thirds of a desktop viewport, subject to 360px and 480px minimums. Large leaves a configurable `--axc-drawer-large-inset` (12rem by default) with a 720px minimum. Full occupies the whole viewport. Below or at 480px all sizes fill the viewport.

Close, Escape and a backdrop click request closure through `onClose`. The panel slides from the right as the backdrop fades in. Both reverse on dismissal. Keep the drawer mounted and set `open` to false to run its exit animation; `afterClose` runs once it finishes. Reduced-motion preferences skip animation. A reopened drawer cancels an unfinished exit. The native modal dialog manages focus and stacking. Place nested modal dialogs or portaled controls in a compatible modal layer; a popup portaled to the document body outside a modal dialog is inert. Put normal flow content directly in the body to use its scrolling.

[Public interface](api/index.api.md)
