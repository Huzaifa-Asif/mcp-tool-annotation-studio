# Release verification

Release claims must be tied to an exact commit. Required evidence:

1. `npm run check` passes.
2. Browser journeys pass in desktop light/dark, 390 px mobile, keyboard-only use, and reduced motion.
3. The sample reaches READY; a missing annotation and a destructive action without confirmation reach NEEDS WORK.
4. Import, JSON export, report export, clear, and invalid/oversized input are exercised.
5. Production has no post-load network requests, console errors, or horizontal overflow.
