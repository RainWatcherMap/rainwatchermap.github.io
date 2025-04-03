using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using DevInterface;
using Menu;
using MoreSlugcats;
using RWCustom;
using Watcher;
using UnityEngine;
using System.IO;
using System.Reflection;

// Token: 0x02000110 RID: 272

/*
   SlugcatSelectMenu.StartGame():

StartPlease startPlease = new GameObject("", new Type[] { typeof(StartPlease) }).GetComponent<StartPlease>();
startPlease.start(this.manager);
*/

/*
   RoomCamera.FireUpSinglePlayerHUD(): remove
*/

class StartPlease : MonoBehaviour {
    public static bool started;

    public void start(ProcessManager m) {
        StartCoroutine(stupidWrapper(m));
    }

    // C# couldn't possible generate this when I do try catch with yield return inside...
    private static System.Collections.IEnumerator stupidWrapper(ProcessManager m) {
        var path = "C:\\Users\\Artem\\Downloads\\rwmap\\data.txt";
        using (var fileStream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 1, useAsync: false))
        using (var sw = new System.IO.StreamWriter(fileStream)) {
            sw.AutoFlush = true;
            sw.WriteLine("Starting");
            System.Collections.IEnumerator it = null;
            try {
                it = stuff(sw, m);
            }
            catch(Exception e) {
                sw.WriteLine(e);
            }

            while(it != null) {
                var contin = false;
                try {
                    contin = it.MoveNext();
                }
                catch(Exception e) {
                    sw.WriteLine(e);
                }
                yield return it.Current;
                if(!contin) break;
            }

            Application.Quit();
        }
    }

    private static void assert(bool cond, string message) {
        if(!cond) throw new Exception("My error: " + message);
    }

    private static void unrand() {
        global::UnityEngine.Random.InitState(0);
    }

    private static System.Collections.IEnumerator stuff(StreamWriter sw, ProcessManager pm) {
        var bas = "C:\\Users\\Artem\\Downloads\\rwmap\\output\\";

        {
            var ii = 0;
            while(pm.currentMainLoop as RainWorldGame == null) {
                ii++;
                if(ii > 1000) throw new Exception("Waiting didn't help?");
                yield return null;
            }
        }
        yield return new WaitForSeconds(5);

		var rainWorld = pm.currentMainLoop as RainWorldGame;

        var iii = 0;
        unrand();
        foreach (Region r in Region.LoadAllRegions(SlugcatStats.Name.Night)) {
            if(r.name.Length == 2) continue;

            {
                var name = Region.GetRegionFullName(r.name, SlugcatStats.Name.Night);

                var dirname = bas + r.name + "\\";
                System.IO.Directory.CreateDirectory(dirname);
                using(var sw2 = new StreamWriter(dirname + "data.json", false)) {
                    sw2.WriteLine("{");
                    sw2.WriteLine("name: \"" + name + "\",");
                    sw2.WriteLine("}");
                }
            }

            assert(rainWorld != null, "rainWorld is null");
            var ow = rainWorld.overWorld;
            assert(rainWorld.overWorld != null, "overWorld is null");
			ow.LoadWorld(r.name, SlugcatStats.Name.Night, SlugcatStats.Timeline.Watcher, false);

			World world = ow.activeWorld;
            assert(world != null, "world is null");

            var cam = rainWorld.rainWorld.MainCamera;

            var renderSize = 256;
            var render = new RenderTexture((int)(renderSize * cam.aspect), renderSize, 24);
            var image = new Texture2D(render.width, render.height, TextureFormat.RGB24, false);
            cam.targetTexture = render;
            sw.WriteLine("Aspect: " + cam.aspect + "\nSize: " + cam.orthographicSize);

            var ii = 0;
            foreach(var room in world.abstractRooms) {
                iii++;

                try {
                    {
                        var dirname = bas + r.name + "\\" + room.name + "\\";
                        System.IO.Directory.CreateDirectory(dirname);
                        using(var sw2 = new StreamWriter(dirname + "data.json", false)) {
                            sw2.WriteLine("{");
                            sw2.WriteLine("mapPos: [" + room.mapPos.x + ", " + room.mapPos.y + "],");
                            sw2.WriteLine("size: [" + room.size.x + ", " + room.size.y + "],");
                            sw2.WriteLine("layer: " + room.layer + ",");
                            sw2.WriteLine("}");
                        }
                    }

                    unrand();
                    world.ActivateRoom(room);
                    //(rainWorld.Players[0].realizedCreature as Player).PlaceInRoom(room.realizedRoom);
                    foreach(var roomPreparer in world.loadingRooms) {
                        while(!roomPreparer.done) {
                            roomPreparer.Update();
                            System.Threading.Thread.Sleep(1);
                        }
                    }
                    while(room.realizedRoom.loadingProgress < 3 || room.realizedRoom.waitToEnterAfterFullyLoaded >= 1) {
                        room.realizedRoom.Update();
                        System.Threading.Thread.Sleep(1);
                    }

                    rainWorld.cameras[0].MoveCamera(room.realizedRoom, 0);
                }
                catch(Exception e) {
                    sw.WriteLine("Room " + r.name + " " + room.name + ": " + e + "\n");
                    continue;
                }

                unrand();
				while(rainWorld.cameras[0].AboutToSwitchRoom) {
                    unrand();
					yield return null;
                }

                var poses = room.realizedRoom.cameraPositions;
                for(var i = 0; i < poses.Length; i++) {
                    unrand();
                    rainWorld.cameras[0].MoveCamera(i);
                    while(rainWorld.cameras[0].AboutToSwitchCameraPos) {
                        unrand();
                        yield return null;
                    }
                    unrand();
                    yield return null;

                    RenderTexture.active = render;
                    image.ReadPixels(new Rect(0, 0, render.width, render.height), 0, 0);
                    image.Apply();
                    RenderTexture.active = null;

                    var dirname = bas + r.name + "\\" + room.name + "\\";
                    System.IO.Directory.CreateDirectory(dirname);

                    var pos = poses[i];

                    byte[] bytes = image.EncodeToPNG();
                    System.IO.File.WriteAllBytes(dirname + pos.x + '$' + pos.y + "$.png", bytes);
                }
            }
        }
    }
}
