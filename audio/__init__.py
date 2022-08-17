#!/usr/bin/env python

import os
import sys
from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
import pygame._sdl2 as sdl2
from threading import main_thread, Thread
from time import time, sleep
import traceback

MUSIC_DIRECTORY = os.path.dirname(__file__) + "/"

EMPTY_SOUND = None #Initialized to an empty bytes object after mixer init

sounds = {}
music = {}
musicActions = []
soundActions = []
remoteMusicActions = []
remoteSoundActions = []
currentMusic = ""

def addRemoteAction(queue,action):
  queue.append(str(time()) + ";" + action)
  last_play = None
  while(len(queue) > 5):
    act = queue.pop(0)

class SoundWrapper:
  def __init__(self, file_name):
    self.file_name = file_name

    self.sound = None
    self.channel = None

    self.name = file_name[:-4]
    sounds[self.name] = self

  def init(self):
    if not os.getenv("DEV_MODE"):
      self.sound = mixer.Sound(MUSIC_DIRECTORY + self.file_name)

  def _play(self):
    self.play()

  def play(self):
    addRemoteAction(remoteSoundActions,"_play;"+self.name)
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
    self.channel = self.sound.play()

  def _stop(self):
    self.stop()

  def stop(self):
    addRemoteAction(remoteSoundActions,"_stop;"+self.name)
    if self.channel:
      self.channel.stop()
      self.channel = None

  def _fadeout(self,duration):
    self.fadeout(self,duration)

  def fadeout(self, duration):
    addRemoteAction(remoteSoundActions,"_fadeout;"+self.name)
    if self.channel:
      self.channel.queue(EMPTY_SOUND)
      self.channel.fadeout(duration)
      self.channel = None

class MusicWrapper:
  def __init__(self, file_name, vamp_file_name=None, loop=False):
    self.file_name = file_name
    self.vamp_file_name = vamp_file_name
    self.loop = loop
    self.delay_time = None
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

  def play(self, delay_ms=None):
    if delay_ms is None:
      self.delay_time = None
      action = "_play;"+self.name
      addRemoteAction(remoteMusicActions,action)
      musicActions.append(action)
    else:
      self.delay_time = time() + delay_ms/1000
      action = "_delayed_play;"+self.name
      addRemoteAction(remoteMusicActions,action+";"+str(delay_ms))
      musicActions.append(action)

  def _delayed_play(self):
    if self.delay_time is None or self.delay_time <= time():
      self.delay_time = None
      musicActions.append("_play;"+self.name)
    else:
      return True

  def _play(self, fade_ms=None):
    if fade_ms is None:
      fade_ms = 0
    else:
      fade_ms = int(fade_ms)
    self._stop()
    self._open()
    loop_count = -1 if self.loop else 0
    if not os.getenv("DEV_MODE"):
      mixer.music.load(self.song)
      mixer.music.play(loops=loop_count, fade_ms=fade_ms)
      if self.vamp:
        mixer.music.queue(self.vamp, loops=-1)
    global currentMusic
    currentMusic = self.name

  def _is_playing(self):
    if os.getenv("DEV_MODE"):
      return False
    global currentMusic
    if self.name == "any":
      return mixer.music.get_busy()
    else:
      return currentMusic ==  self.name

  def _will_play(self):
    if self.name == "any":
      for action in musicActions:
        if action.find("_play;")>=0 or action.find("_delayed_play;")>=0:
          return True
      return False
    else:
      return musicActions.count("_play;"+self.name)>0 or musicActions.count("_delayed_play;"+self.name)>0

  def stop(self):
    action = "_stop;"+self.name
    addRemoteAction(remoteMusicActions,action)
    musicActions.append(action)

  def _stop(self):
    if not os.getenv("DEV_MODE"):
      mixer.music.stop()
      mixer.music.unload()
    self._close()
    global currentMusic
    if currentMusic == self.name:
      currentMusic = ""
    
  def fadein(self, duration=None):
    if duration is None:
      duration = 0
    else:
      duration = int(duration)
    action = "_fadein;"+self.name+";"+str(duration)
    addRemoteAction(remoteMusicActions,action)
    musicActions.append(action)
  
  def _fadein(self, duration=None):
    self._play(fade_ms=duration)

  def fadeout(self, duration=None):
    if duration is None:
      duration = 0
    else:
      duration = int(duration)
    action = "_fadeout;"+self.name+";"+str(duration)
    addRemoteAction(remoteMusicActions,action)
    musicActions.append(action)

  def _fadeout(self, duration=None):
    if duration is None:
      duration = 0
    else:
      duration = int(duration)
    if not os.getenv("DEV_MODE"):
      mixer.music.fadeout(duration)
      mixer.music.unload()
    self._close()

def prewarm_audio():
  MusicWrapper("any.ogg")# for checking general music state
  MusicWrapper("idle.ogg", loop=True)
  MusicWrapper("battle1.ogg", vamp_file_name="battle1Loop.ogg")
  MusicWrapper("dm1.ogg", vamp_file_name="dm1Loop.ogg")
  MusicWrapper("snekBattle.ogg")
  MusicWrapper("waiting.ogg", loop=True)
  MusicWrapper("victory.ogg")
  MusicWrapper("lose.ogg")
  SoundWrapper("kick.wav")
  SoundWrapper("placeBomb.wav")
  SoundWrapper("hurt.wav")
  SoundWrapper("death.wav")
  SoundWrapper("explosion.wav")

  # Now run prewarm thread
  def thread_func():
    if not os.getenv("DEV_MODE"):
      mixer.init(devicename=os.getenv("ORB_AUDIO"), channels=1)

      global EMPTY_SOUND
      EMPTY_SOUND = mixer.Sound(bytes(1))

      for sound in sounds.values():
        sound.init()

    print("Finished prewarming audio.", file=sys.stderr)

    # thread now to handle music
    first_run = True
    while True:
      sleep(0.1)
      if not main_thread().is_alive():
        return

      for i in range(len(soundActions)):
        action = soundActions.pop(0)
        if first_run:
          continue
        asplit = action.split(";")
        method = asplit[0]
        sound = sounds[asplit[1]]
        arg = asplit[2] if len(asplit) > 2 else None
        if arg == "":
          arg = None
        if method and sound:
          todo=getattr(SoundWrapper, method)
          notdone = False
          if arg is None:
            notdone = todo(sound)
          else:
            notdone = todo(sound, arg)
          if(notdone):
            soundActions.append(action)


      for i in range(len(musicActions)):
        action = musicActions.pop(0)
        if first_run:
          if i < len(musicActions) - 1:
            continue
          else:
            first_run = False
        asplit = action.split(";")
        method = asplit[0]
        song = music[asplit[1]]
        arg = asplit[2] if len(asplit) > 2 else None
        if arg == "":
          arg = None
        if method and song:
          todo=getattr(MusicWrapper, method)
          notdone = False
          if arg is None:
            notdone = todo(song)
          else:
            notdone = todo(song, arg)
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
  print("\n".join(names), file=sys.stderr)
  pygame.quit()

