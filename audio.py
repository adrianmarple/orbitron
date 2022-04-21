#!/usr/bin/env python

import os
from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
import pygame._sdl2 as sdl2
from threading import main_thread, Thread
from time import time, sleep
import traceback

MUSIC_DIRECTORY = os.path.dirname(__file__) + "/audio/"

EMPTY_SOUND = None #Initialized to an empty bytes object after mixer init

sounds = {}
music = {}
musicActions = []
currentMusic = ""

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
    self.volume = 1.0
    self.volumeInc = 0.05

    self.song = None
    self.vamp = None

    self.name = file_name[:-4]
    music[self.name] = self

  def _open(self):
    self.song = open(MUSIC_DIRECTORY + self.file_name, "r+b")
    if self.vamp_file_name:
      self.vamp = open(MUSIC_DIRECTORY + self.vamp_file_name, "r+b")

  def _close(self):
    if self.song:
      self.song.close()
      self.song = None
    if self.vamp:
      self.vamp.close()
      self.vamp = None

  def play(self, fade_ms=None, delay_ms=None):
    if fade_ms is None:
      fade_ms = self.fade_ms

    if delay_ms is None:
      delay_ms = self.delay_ms

    if delay_ms is None:
      self.delay_time = None
      self.next_fade_ms = fade_ms
      musicActions.append("_play;"+self.name)
    else:
      self.delay_time = time() + delay_ms/1000
      self.next_fade_ms = fade_ms
      musicActions.append("_delayed_play;"+self.name)

  def _delayed_play(self):
    if self.delay_time is None or self.delay_time <= time():
      self.delay_time = None
      musicActions.append("_play;"+self.name)
    else:
      return True

  def _play(self):
    self._stop()
    self._open()
    loop_count = -1 if self.loop else 0
    mixer.music.load(self.song)
    mixer.music.play(loops=loop_count, fade_ms=self.next_fade_ms)
    if self.vamp:
      mixer.music.queue(self.vamp, loops=-1)
    global currentMusic
    currentMusic = self.name

  def is_playing(self):
    if self.name == "any":
      return mixer.music.get_busy()
    else:
      global currentMusic
      return currentMusic ==  self.name

  def will_play(self):
    if self.name == "any":
      for action in musicActions:
        if action.find("_play;")>=0:
          return True
      return False
    else:
      return musicActions.count("_play;"+self.name)>0

  def stop(self):
    musicActions.append("_stop;"+self.name)

  def _stop(self):
    mixer.music.stop()
    mixer.music.unload()
    self._close()

  def fadeout(self, duration=None):
    if duration is None:
      duration = self.fade_ms
    self.next_fade_ms = duration
    musicActions.append("_fadeout;"+self.name)

  def _fadeout(self):
    mixer.music.fadeout(self.next_fade_ms)
    mixer.music.unload()
    self._close()

  def set_volume(self, val, force=False):
    self.volume = val
    if force:
      mixer.music.set_volume(val)
    else:    
      musicActions.append("_set_volume;"+self.name)

  def _set_volume(self):
    if abs(mixer.music.get_volume() - self.volume) <= self.volumeInc:
      mixer.music.set_volume(self.volume)
      return None
    else:
      inc = self.volumeInc
      if mixer.music.get_volume() - self.volume > 0:
        inc = -inc
      mixer.music.set_volume(mixer.music.get_volume() + inc)
      return True

  def get_volume(self):
    return mixer.music.get_volume()


def prewarm_audio():
  MusicWrapper("any.ogg")# for checking general music state
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
    mixer.init(devicename=os.getenv("ORB_AUDIO"), channels=1)

    global EMPTY_SOUND
    EMPTY_SOUND = mixer.Sound(bytes(1))

    for sound in sounds.values():
      sound.init()

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
      for i in range(len(musicActions)):
        action = musicActions.pop(0)
        asplit = action.split(";")
        method=asplit[0]
        song=music[asplit[1]]
        if method and song:
          todo=getattr(MusicWrapper, method)
          notdone=todo(song)
          if(notdone):
            musicActions.append(action)


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

