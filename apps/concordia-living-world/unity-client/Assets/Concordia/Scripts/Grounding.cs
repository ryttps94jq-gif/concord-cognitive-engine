using UnityEngine;

namespace Concordia
{
    public static class Grounding
    {
        public const string FORCE_REFRESH_0024 = "world-bed-recover-floor";

        public static void Snap(CharacterController cc)
        {
            if (!cc) return;
            var t = cc.transform;
            var origin = t.position + Vector3.up * 8f;
            float y = 0.08f;
            var hits = Physics.SphereCastAll(origin, 0.18f, Vector3.down, 16f, ~0, QueryTriggerInteraction.Ignore);
            // Closest-hit from +8 m is a tree or a roof. The floor is
            // the lowest walkable hit near y=0, not the first collider
            // the ray meets.
            float bestY = 99f;
            bool found = false;
            foreach (var h in hits)
            {
                if (!h.collider) continue;
                if (h.transform == t || h.transform.IsChildOf(t)) continue;
                if (h.normal.y < 0.4f) continue;
                if (h.point.y < -0.5f || h.point.y > 1.5f) continue;
                var sz = h.collider.bounds.size;
                if (sz.y > 8f) continue;
                if (h.point.y < bestY) { bestY = h.point.y; y = h.point.y + 0.04f; found = true; }
            }
            if (!found || y < -0.5f || y > 1.5f) y = 0.08f;
            cc.enabled = false;
            t.position = new Vector3(t.position.x, y, t.position.z);
            cc.enabled = true;
        }

        /// <summary>
        /// Kill-plane. You do not leave a world by falling off its bed.
        /// Hub spawn is the Court; realms spawn at the return portal approach.
        /// </summary>
        public static bool Recover(CharacterController cc, WorldId world)
        {
            if (!cc) return false;
            var t = cc.transform;
            var p = t.position;
            float r = new Vector2(p.x, p.z).magnitude;
            float bed = world == WorldId.Hub ? Canon.BedRadius : Canon.RealmBed;
            if (p.y >= -2f && r <= bed) return false;
            var spawn = world == WorldId.Hub ? Canon.Spawn : new Vector3(0f, 0.12f, 2f);
            cc.enabled = false;
            t.position = spawn;
            cc.enabled = true;
            Snap(cc);
            var player = ConcordiaPlayer.Live;
            if (player) player.Notice("The ground holds. You do not leave the world by falling.");
            return true;
        }

        public static CharacterController EnsureController(GameObject go, float height = 1.8f)
        {
            var cc = go.GetComponent<CharacterController>();
            if (!cc) cc = go.AddComponent<CharacterController>();
            cc.height = height;
            cc.center = new Vector3(0, height * 0.5f, 0);
            cc.radius = 0.28f;
            cc.slopeLimit = 50f;
            cc.stepOffset = 0.4f;
            cc.minMoveDistance = 0f;
            cc.skinWidth = 0.08f;
            return cc;
        }
    }
}
