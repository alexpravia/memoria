import React, { useCallback, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";

interface LightboxState {
  visible: boolean;
  photoUrl: string | null;
  description?: string | null;
  tags?: string[];
  peopleNames?: string[];
}

interface OpenOpts {
  photoUrl: string;
  description?: string | null;
  tags?: string[];
  peopleNames?: string[];
}

/**
 * Hook that manages a single PhotoLightbox modal for a screen.
 * Returns the modal element to render plus `open`/`close` handles.
 */
export function usePhotoLightbox() {
  const [state, setState] = useState<LightboxState>({
    visible: false,
    photoUrl: null,
  });

  const open = useCallback((opts: OpenOpts) => {
    setState({
      visible: true,
      photoUrl: opts.photoUrl,
      description: opts.description ?? null,
      tags: opts.tags,
      peopleNames: opts.peopleNames,
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const lightbox = (
    <PhotoLightbox
      visible={state.visible}
      photoUrl={state.photoUrl}
      description={state.description}
      tags={state.tags}
      peopleNames={state.peopleNames}
      onClose={close}
    />
  );

  return { open, close, lightbox };
}

/**
 * Returns a stable onPress handler that fires `onTap` on the first tap.
 * Thin `useCallback` wrapper — no timing logic, no double-tap detection.
 */
export function useTapToOpen(onTap: () => void): () => void {
  return useCallback(onTap, [onTap]);
}
