#!/usr/bin/env python

from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
import pygame._sdl2 as sdl2
from threading import main_thread, Thread
from time import time, sleep

MUSIC_DIRECTORY = "/home/pi/Rhomberman/audio/"

EMPTY_SOUND = None #Initialized to an empty bytes object after mixer init

sounds = {}
music = {}
musicActions = []

class SoundWrapper:
  def __init__(self, file_name, loop=False, fade_ms=0, delay_ms=None):
    self.file_name = file_name
    self.loop = loop
    self.fade_ms = fade_ms
    self.delay_ms = delay_ms
    self.delay_fade_ms = None
    self.delay_time = None

    self.sound = None
    self.channel = None

    self.name = file_name[:-4]
    sounds[self.name] = self

  def init(self):
    self.sound = mixer.Sound(MUSIC_DIRECTORY + self.file_name)

  def play(self, fade_ms=None, delay_ms=None):
    if not self.sound:
      return
    elif self.sound.get_num_channels() > 0:
      if self.channel:
        if not self.channel.get_busy():
          self.sound.stop()
        else:
          return
      else:
        self.sound.stop()

    if fade_ms is None:
      fade_ms = self.fade_ms

    if delay_ms is None:
      delay_ms = self.delay_ms

    if delay_ms is None:
      self.delay_time = None
      self._play(fade_ms=fade_ms)
    else:
      self.delay_time = time() + delay_ms/1000
      if fade_ms is not None:
        self.delay_fade_ms = fade_ms
      else:
        self.delay_fade_ms = None

  def _play(self, fade_ms=None):
    loop_count = -1 if self.loop else 0
    self.channel = self.sound.play(loops=loop_count, fade_ms=fade_ms)

  def stop(self):
    if self.channel:
      self.channel.stop()
      self.channel = None

  def fadeout(self, duration):
    if self.channel:
      self.channel.queue(EMPTY_SOUND)
      self.channel.fadeout(duration)
      self.channel = None

class MusicWrapper:
  def __init__(self, file_name, vamp_file_name=None, loop=False, fade_ms=0, delay_ms=None):
    self.file_name = file_name
    self.vamp_file_name = vamp_file_name
    self.loop = loop
    self.fade_ms = fade_ms
    self.delay_ms = delay_ms
    self.delay_time = None
    self.next_fade_ms = None

    self.song = None
    self.vamp = None

    self.name = file_name[:-4]
    music[self.name] = self

  def init(self):
    self.song = open(MUSIC_DIRECTORY + self.file_name, "r+b")
    if self.vamp_file_name:
      self.vamp = open(MUSIC_DIRECTORY + self.vamp_file_name, "r+b")

  def play(self, fade_ms=None, delay_ms=None):
    if not self.song:
      return

    if fade_ms is None:
      fade_ms = self.fade_ms

    if delay_ms is None:
      delay_ms = self.delay_ms

    if delay_ms is None:
      self.delay_time = None
      self.next_fade_ms = fade_ms
      self.stop()
      musicActions.append("play;"+self.name)
    else:
      self.delay_time = time() + delay_ms/1000
      self.next_fade_ms = fade_ms

  def _play(self):
    loop_count = -1 if self.loop else 0
    mixer.music.load(self.song, "ogg")
    mixer.music.play(loops=loop_count, fade_ms=self.next_fade_ms)
    if self.vamp:
      mixer.music.queue(self.vamp, "ogg", loops=-1)

  def stop(self):
    musicActions.append("stop;"+self.name)

  def _stop(self):
    mixer.music.stop()
    mixer.music.unload()

  def fadeout(self, duration=None):
    if duration is None:
      duration = self.fade_ms
    self.next_fade_ms = duration
    musicActions.append("fade;"+self.name)

  def _fadeout(self):
    mixer.music.fadeout(self.next_fade_ms)
    mixer.music.unload()


def prewarm_audio():
  MusicWrapper("battle1.ogg", vamp_file_name="battle1Loop.ogg")
  MusicWrapper("dm1.ogg", vamp_file_name="dm1Loop.ogg")
  MusicWrapper("snekBattle.ogg")
  MusicWrapper("waiting.ogg", loop=True, fade_ms=2000)
  MusicWrapper("victory.ogg", vamp_file_name="victoryLoop.ogg")
  SoundWrapper("kick.wav")
  SoundWrapper("placeBomb.wav")
  SoundWrapper("hurt.wav")
  SoundWrapper("death.wav")
  SoundWrapper("explosion.wav")

  # Now run prewarm thread
  def thread_func():
    # TODO put this in an environment variable
    try:
      mixer.init(devicename="USB Audio Device, USB Audio", channels=1)
    except:
      mixer.init(devicename="USB PnP Sound Device, USB Audio", channels=1)

    global EMPTY_SOUND
    EMPTY_SOUND = mixer.Sound(bytes(1))

    for sound in sounds.values():
      sound.init()
    for song in music.values():
      music.init()

    music["waiting"].play()
    print("Finished prewarming audio.")


    # thread now to handle vamps
    while True:
      sleep(0.1)
      if not main_thread().is_alive():
        return

      for sound in sounds.values():
        if sound.delay_time is not None and sound.delay_time <= time():
          sound.delay_time = None
          sound._play(sound.delay_fade_ms)
      for song in music.values():
        if song.delay_time is not None and song.delay_time <= time():
          song.delay_time = None
          song.play(song.next_fade_ms)
      for actionString in musicActions:
        action = actionString.split(";")
        music[action[2]][action[1]]
      musicActions.clear()


  prewarm_thread = Thread(target=thread_func)
  prewarm_thread.start()




def list_devices():
  import pygame
  import pygame._sdl2 as sdl2
  pygame.init()
  is_capture = 0  # zero to request playback devices, non-zero to request recording devices
  num = sdl2.get_num_audio_devices(is_capture)
  names = [str(sdl2.get_audio_device_name(i, is_capture), encoding="utf-8") for i in range(num)]
  print("\n".join(names))
  pygame.quit()

