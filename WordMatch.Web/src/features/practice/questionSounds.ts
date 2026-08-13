import { areFeedbackSoundsEnabled } from "@/features/practice/hooks/useFeedbackSoundPreference";

type SoundType = "correct" | "wrong" | "showAnswer";

const soundSources: Record<SoundType, string> = {
  correct: "/sounds/correct.wav",
  wrong: "/sounds/wrong.wav",
  showAnswer: "/sounds/show-answer.wav",
};

const soundVolumes: Record<SoundType, number> = {
  correct: 1,
  wrong: 1,
  showAnswer: 1,
};

const audioElements: Record<SoundType, HTMLAudioElement | null> = {
  correct: createAudioElement(soundSources.correct, soundVolumes.correct),
  wrong: createAudioElement(soundSources.wrong, soundVolumes.wrong),
  showAnswer: createAudioElement(
    soundSources.showAnswer,
    soundVolumes.showAnswer,
  ),
};

const audioBuffers = new Map<SoundType, AudioBuffer>();
const audioBufferPromises = new Map<SoundType, Promise<AudioBuffer | null>>();
let audioContext: AudioContext | null = null;

function createAudioElement(source: string, volume: number) {
  if (typeof Audio === "undefined") return null;

  const audio = new Audio(source);
  audio.preload = "auto";
  audio.volume = Math.min(volume, 1);
  audio.load();

  return audio;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;

  audioContext ??= new AudioContext();
  return audioContext;
}

function preloadSound(type: SoundType) {
  const existingBuffer = audioBuffers.get(type);
  if (existingBuffer) return Promise.resolve(existingBuffer);

  const existingPromise = audioBufferPromises.get(type);
  if (existingPromise) return existingPromise;

  const context = getAudioContext();
  if (!context) return Promise.resolve(null);

  const promise = fetch(soundSources[type])
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      audioBuffers.set(type, audioBuffer);
      return audioBuffer;
    })
    .catch(() => null);

  audioBufferPromises.set(type, promise);
  return promise;
}

function playAudioElement(sound: HTMLAudioElement | null) {
  if (!sound) return;

  sound.currentTime = 0;
  void sound.play().catch(() => {
    // Browsers can block audio in a few edge cases. The answer flow should continue.
  });
}

async function playAudioBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  volume: number,
) {
  if (context.state === "suspended") {
    await context.resume();
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function playSound(type: SoundType) {
  if (!areFeedbackSoundsEnabled()) return;

  const context = getAudioContext();
  const buffer = audioBuffers.get(type);

  if (!context || !buffer) {
    playAudioElement(audioElements[type]);
    void preloadSound(type);
    return;
  }

  void playAudioBuffer(context, buffer, soundVolumes[type]);
}

export function preloadQuestionSounds() {
  void preloadSound("correct");
  void preloadSound("wrong");
  void preloadSound("showAnswer");
}

export function playCorrectSound() {
  playSound("correct");
}

export function playWrongSound() {
  playSound("wrong");
}

export function playShowAnswerSound() {
  playSound("showAnswer");
}

preloadQuestionSounds();
