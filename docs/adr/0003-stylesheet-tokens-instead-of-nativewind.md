# StyleSheet with typed tokens instead of NativeWind

The spec lists NativeWind, but we style with React Native `StyleSheet` and a typed token module. NativeWind v5 (Tailwind 4) is still a release candidate, v4 ties us to Tailwind 3 on Expo SDK 57, the spec itself warns about web `Pressable` behaviour driven only by `className`, and the visual reference we port from the earlier prototype is already written with `StyleSheet`. Revisit when NativeWind v5 is stable if utility classes become worth the extra build layer.
