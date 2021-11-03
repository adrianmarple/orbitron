#!/usr/bin/env python

from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
import pygame._sdl2 as sdl2
from threading import Thread


class ChannelShell:
  def stop(self):
    pass
  def get_queue(self):
    pass
  def queue(self, sound):
    pass

class SoundShell:
  def play(self, loops=0, fade_ms=0):
    return ChannelShell()
  def stop(self):
    pass
  def fadeout(self, duration):
    pass

sounds = {}


def prewarm_audio(sound_file_names, music_directory="/home/pi/Rhomberman/audio/", start_loop=""):
  def thread_func():
    try:
      mixer.init(devicename="USB Audio Device, USB Audio")
    except:
      mixer.init(devicename="USB PnP Sound Device, USB Audio")


    for file_name in sound_file_names:
      name = file_name[:-4]
      sounds[name] = mixer.Sound(music_directory + file_name)

    if start_loop:
      sounds[start_loop].play(loops=-1)

    print("Finished prewarming audio.")


  for file_name in sound_file_names:
    name = file_name[:-4]
    sounds[name] = SoundShell()

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

# list_devices()
