class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverMock;

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.getAnimations !== "function"
) {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
}

if (
  typeof Document !== "undefined" &&
  typeof Document.prototype.getAnimations !== "function"
) {
  Object.defineProperty(Document.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
}
