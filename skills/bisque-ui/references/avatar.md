# Avatar

A picture of a user, with a fallback while it loads or when it fails.

Source after `bisque copy`: `<copy>/avatar/avatar.rx`. Parts are named exports of that file.

## Anatomy

```rx
import { AvatarRoot, AvatarImage, AvatarFallback } from "./bisque/avatar/avatar.rx"

<AvatarRoot>
  <AvatarImage />
  <AvatarFallback />
</AvatarRoot>
```

## AvatarRoot

Renders `<span>`. Holds the picture's loading status and shares it with the image and fallback inside it. Size and shape the avatar on this element. Avatars in a list that comes from a server can be removed by a new answer at any time.

## AvatarImage

Renders `<img>`. The picture. Its source is loaded off-screen first, and the `<img>` is added only once it has loaded, so a broken image never shows.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` |  | The picture's URL. Without `src` or `srcset` the fallback shows. |
| `srcset` | `string` |  | Candidate sources for the picture, as on an `<img>`. |
| `crossorigin` | `"anonymous" \| "use-credentials" \| ""` |  | The CORS mode for loading the picture, as on an `<img>`. |
| `referrerpolicy` | `string` |  | The referrer policy for loading the picture, as on an `<img>`. |
| `onLoadingStatusChange` | `(status: ImageLoadingStatus) => void` |  | Called with `"loading"`, then `"loaded"` or `"error"`, each time the source is loaded. It is called from an effect, after the status has changed on screen. |

| Data attribute | Meaning |
| --- | --- |
| `data-ending-style` | Present while the `<img>` animates out because a new source started loading. It is removed when its transitions end. |
| `data-starting-style` | Present for the first frame after the `<img>` appears: style the state it animates in from. |

## AvatarFallback

Renders `<span>`. Shown while the picture hasn't loaded: while it loads, when it fails, and when there is none. Usually initials or an icon.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `delay` | `number` | `0` | How long to wait before showing the fallback, in ms, so a picture that loads quickly doesn't flash it first. |
