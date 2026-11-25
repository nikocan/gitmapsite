# Gitmapp agent squirrel

The Gitmapp signature is a single front-facing squirrel wearing sunglasses, a jacket and a tie. Its bushy tail curves over the left shoulder. The heavy silhouette and open counters keep the face and collar legible at interface sizes.

The interface badge follows the GitHub mark’s logic: one Citrus (#E4FF3D) circle with the Ink silhouette inside, paired in the sidebar with a heavy, tightly tracked lowercase **gitmapp** set in Inter ExtraBold. The badge is `mark.svg`, and the favicon uses the same file. The onboarding guide Fındık is this same agent, animated only through motion.

Use the standalone mark in Ink (#171C21) on light surfaces and Paper (#F2F4F5) on dark surfaces. The installed app and favicon use the same silhouette on the Gitmapp Citrus background (#E4FF3D). Supply the accessible name “Gitmapp” where the mark identifies the product. Decorative repetitions can be hidden from assistive technology.

## Assets

- `squirrel.svg` is the single-color vector master. The `agent` group is shared by the application UI.
- `lockup-light.svg` and `lockup-dark.svg` are standalone versions for their respective backgrounds.
- `app-icon.svg` is the favicon. The PNGs in `pwa/` are the install icons. Regenerate the two standalone variants, favicon and PNGs with `python tools/build_brand.py` and Inkscape.
- `ecosystem.svg` contains the twelve interface symbols. GitHub account and repository actions keep their provider icon.
- `motion.css` defines a short lookout gesture that respects the system’s reduced-motion preference.

## Campaign film

*Small idea. Big appetite.* follows a maker adapting the Nova CRM template into a workspace for Acorn Studio. The 42-second English film uses localized captures from the working product and an original instrumental score. Open Keşfet and select **Tanıtım filmini izle**. The original campaign edition, including the bee and earlier brand artwork, is archived in `film/` with its caption track.
