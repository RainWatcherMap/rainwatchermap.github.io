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
using MonoMod.RuntimeDetour.Platforms;
using System.Linq;

// Token: 0x02000110 RID: 272

/*
   SlugcatSelectMenu.StartGame():

StartPlease startPlease = new GameObject("", new Type[] { typeof(StartPlease) }).GetComponent<StartPlease>();
startPlease.start(this.manager);
*/

/*
   RoomCamera.FireUpSinglePlayerHUD(): remove
*/

// See MapExporter in game dll

class StartPlease : MonoBehaviour {
    public static bool started;
    static string begin;

    public void start(ProcessManager m) {
        begin = "C:\\Users\\Artem\\Downloads\\rainwatchermap.github.io\\raw\\";
        StartCoroutine(stupidWrapper(m));
    }

    // C# couldn't possible generate this when I do try catch with yield return inside...
    private static System.Collections.IEnumerator stupidWrapper(ProcessManager m) {
        var path = begin + "data.txt";
        using (var fileStream = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 1, useAsync: false))
        using (var log = new System.IO.StreamWriter(fileStream)) {
            log.AutoFlush = true;
            log.WriteLine("Starting");
            System.Collections.IEnumerator it = null;
            try {
                it = stuff(log, m);
            }
            catch(Exception e) {
                log.WriteLine(e);
            }

            while(it != null) {
                var contin = false;
                try {
                    contin = it.MoveNext();
                }
                catch(Exception e) {
                    log.WriteLine(e);
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

    private static System.Collections.IEnumerator stuff(StreamWriter log, ProcessManager pm) {
        var bas = begin + "regions\\";

        {
            var ii = 0;
            while(pm.currentMainLoop as RainWorldGame == null) {
                ii++;
                if(ii > 1000) throw new Exception("Waiting didn't help?");
                yield return null;
            }
        }
        yield return new WaitForSeconds(3);

		var rainWorld = pm.currentMainLoop as RainWorldGame;

        // ignore.json
        var list = new[]{
            "CL",
            "DM",
            "DS",
            "GW",
            "HR",
            "LC",
            "LM",
            "MS",
            "OE",
            "RM",
            "SB",
            "SI",
            "SL",
            "SS",
            "UG",
            "UW",
            "VS"
        };

        var iii = 0;
        unrand();
        foreach (Region r in Region.LoadAllRegions(SlugcatStats.Name.Night)) {
            if(list.Contains(r.name)) continue;
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
            Screen.SetResolution((int)(renderSize * cam.aspect), renderSize, FullScreenMode.Windowed);

            var ii = 0;
            foreach(var room in world.abstractRooms) {
				var prev = rainWorld.cameras[0].room;
                try { if(prev != null) prev.abstractRoom.Abstractize(); } catch(Exception e) {}
                iii++;

                var dirname = bas + r.name + "\\" + room.name + "\\";
                System.IO.Directory.CreateDirectory(dirname);

                try {
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

                    using(var sw2 = new StreamWriter(dirname + "data.json", false)) {
                        sw2.WriteLine("{");
                        sw2.WriteLine("mapPos: [" + room.mapPos.x + ", " + room.mapPos.y + "],");
                        sw2.WriteLine("size: [" + room.size.x + ", " + room.size.y + "],");
                        sw2.WriteLine("layer: " + room.layer + ",");
                        sw2.WriteLine("shelter: " + (room.shelter ? "true" : "false") + ",");

                        var warpPoints = new List<PlacedObject>();
                        var echoSpots = new List<PlacedObject>();
                        var karmaFlowers = new List<PlacedObject>();
                        foreach(var obj in room.realizedRoom.roomSettings.placedObjects) {
                            if(obj.type == PlacedObject.Type.WarpPoint) {
                                warpPoints.Add(obj);
                            }
                            else if(obj.type == WatcherEnums.PlacedObjectType.SpinningTopSpot) {
                                echoSpots.Add(obj);
                            }
                            else if(obj.type == PlacedObject.Type.KarmaFlower) {
                                karmaFlowers.Add(obj);
                            }
                        }

                        sw2.WriteLine("warpPoints: [");
                        foreach(var obj in warpPoints) {
                            var data = obj.data as WarpPoint.WarpPointData;
                            var reg = data.RegionString;
                            var roomName = data.destRoom;
                            var pos = data.destPos;
                            var oneWay = data.oneWay;

                            sw2.WriteLine("{");
                            sw2.WriteLine("pos: " + "[" + obj.pos.x + ", " + obj.pos.y + "]" + ",");
                            sw2.WriteLine("destRegion: " + (reg != null ? "\"" + reg + "\"" : "null") + ",");
                            sw2.WriteLine("destRoom: " + (roomName != null ? "\"" + roomName + "\"" : "null") + ",");
                            sw2.WriteLine("destPos: " + (pos != null ? "[" + pos.Value.x + ", " + pos.Value.y + "]" : "null") + ",");
                            sw2.WriteLine("oneWay: " + (oneWay ? "true" : "false") + ",");
                            sw2.WriteLine("ripple: " + (data.rippleWarp ? "true" : "false") + ",");
                            sw2.WriteLine("},");
                        }
                        sw2.WriteLine("],");

                        sw2.WriteLine("echoSpots: [");
                        foreach(var obj in echoSpots) {
                            var data = obj.data as SpinningTopData;
                            var panelPos = data.panelPos;
                            var destPos = data.destPos;
                            var destRegion = data.RegionString;
                            var destRoom = data.destRoom;
                            var spawnId = data.spawnIdentifier;

                            sw2.WriteLine("{");
                            sw2.WriteLine("pos: " + "[" + obj.pos.x + ", " + obj.pos.y + "]" + ",");
                            sw2.WriteLine("panelPos: " + (panelPos != null ? "[" + panelPos.x + ", " + panelPos.y + "]" : "null") + ",");
                            sw2.WriteLine("destPos: " + (destPos != null ? "[" + destPos.Value.x + ", " + destPos.Value.y + "]" : "null") + ",");
                            sw2.WriteLine("destRegion: " + (destRegion != null ? "\"" + destRegion + "\"" : "null") + ",");
                            sw2.WriteLine("destRoom: " + (destRoom != null ? "\"" + destRoom + "\"" : "null") + ",");
                            sw2.WriteLine("spawnId: " + spawnId + ",");
                            sw2.WriteLine("},");
                        }
                        sw2.WriteLine("],");

                        sw2.WriteLine("karmaFlowers: [");
                        foreach(var obj in karmaFlowers) {
                            sw2.WriteLine("{");
                            sw2.WriteLine("pos: " + "[" + obj.pos.x + ", " + obj.pos.y + "]" + ",");
                            sw2.WriteLine("},");
                        }
                        sw2.WriteLine("],");

                        sw2.WriteLine("shortcuts: [");
                        foreach(var shortcut in room.realizedRoom.shortcuts) {
                            var conn = shortcut.connection;
                            var s = conn.startCoord;
                            var e = conn.destinationCoord;
                            // lol. destinationCoord is world coord, but room is not correct.
                            // It is constructed from source room. Why would you do that?
                            string eRoomName = null;
                            try {
                                var eRoom = world.GetAbstractRoom(room.connections[shortcut.destNode]);
                                eRoomName = eRoom.name;
                            }
                            catch(Exception ee) {
                                log.WriteLine("While extracting connection: " + ee);
                            }

                            sw2.WriteLine("{");
                            sw2.WriteLine("type: \"" + shortcut.shortCutType.value + "\",");
                            sw2.WriteLine("startRoom: \"" + s.ResolveRoomName() + "\",");
                            sw2.WriteLine("startPos: [" + s.x + ", " + s.y + "],");
                            sw2.WriteLine("endRoom: " + (eRoomName != null ? "\"" + eRoomName + "\"" : "null") + ",");
                            sw2.WriteLine("endPos: [" + e.x + ", " + e.y + "],");
                            sw2.WriteLine("},");
                        }
                        sw2.WriteLine("],");

                        sw2.WriteLine("}");
                    }
                    continue;

                    rainWorld.cameras[0].MoveCamera(room.realizedRoom, 0);
                }
                catch(Exception e) {
                    log.WriteLine("Room " + r.name + " " + room.name + ": " + e + "\n");
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

                    var pos = poses[i];
                    ScreenCapture.CaptureScreenshot(dirname + pos.x + '$' + pos.y + "$.png");
                }
            }
        }
    }
}
