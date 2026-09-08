#!/usr/bin/env python3
"""ConKay OpenCascade (OCP) CLI — real B-rep STEP export/import + mesh tessellation.

Mac kitchen venv: ~/.zuko/venvs/cad-occ
Honesty: advanced B-rep (ADVANCED_FACE / PLANAR surfaces), NOT faceted POLY_LOOP.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

ADVANCED_MARKERS = (
    "ADVANCED_FACE",
    "ADVANCED_BREP_SHAPE_REPRESENTATION",
    "MANIFOLD_SOLID_BREP",
    "AXIS2_PLACEMENT_3D",
)
FACETED_MARKERS = ("POLY_LOOP", "TRIANGULATED_FACE", "COMPLEX_TRIANGULATED_SURFACE")


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _fail(reason: str, **extra) -> dict:
    out = {"ok": False, "reason": reason, **extra}
    return out


def probe() -> dict:
    try:
        from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox  # noqa: F401
        import OCP

        ver = getattr(OCP, "__version__", None) or "cadquery-ocp"
        return {
            "ok": True,
            "kernel": "ocp",
            "package": "cadquery-ocp",
            "ocp": True,
            "version_hint": ver,
            "python": sys.executable,
            "honesty": {
                "note": "OpenCascade via cadquery-ocp (OCP). Real B-rep STEP — not faceted POLY_LOOP.",
            },
        }
    except Exception as e:
        return _fail("ocp_import_failed", error=str(e), python=sys.executable)


def _make_shape(kind: str, params: dict):
    from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
    from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir

    kind = (kind or "box").lower()
    if kind in ("box", "cube", "rect", "beam"):
        dx = float(params.get("dx") or params.get("x") or params.get("width") or 10.0)
        dy = float(params.get("dy") or params.get("y") or params.get("depth") or 10.0)
        dz = float(params.get("dz") or params.get("z") or params.get("height") or 10.0)
        return BRepPrimAPI_MakeBox(abs(dx), abs(dy), abs(dz)).Shape(), {
            "kind": "box",
            "dx": abs(dx),
            "dy": abs(dy),
            "dz": abs(dz),
        }
    if kind in ("cylinder", "cyl", "pipe", "rod"):
        r = float(params.get("r") or params.get("radius") or 5.0)
        h = float(params.get("h") or params.get("height") or 20.0)
        ax = gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1))
        return BRepPrimAPI_MakeCylinder(ax, abs(r), abs(h)).Shape(), {
            "kind": "cylinder",
            "r": abs(r),
            "h": abs(h),
        }
    raise ValueError(f"unsupported_archetype:{kind}")


def _translate(shape, x: float, y: float, z: float):
    from OCP.gp import gp_Trsf, gp_Vec
    from OCP.BRepBuilderAPI import BRepBuilderAPI_Transform

    if abs(x) < 1e-12 and abs(y) < 1e-12 and abs(z) < 1e-12:
        return shape
    tr = gp_Trsf()
    tr.SetTranslation(gp_Vec(float(x), float(y), float(z)))
    return BRepBuilderAPI_Transform(shape, tr, True).Shape()


def _write_step(shape, path: str, name: str = "conkay_occ") -> dict:
    from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
    from OCP.IFSelect import IFSelect_RetDone
    from OCP.Interface import Interface_Static

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    writer = STEPControl_Writer()
    try:
        Interface_Static.SetCVal_s("write.step.schema", "AP214")
    except Exception:
        pass
    try:
        Interface_Static.SetCVal_s("write.step.product.name", str(name)[:64])
    except Exception:
        pass
    st = writer.Transfer(shape, STEPControl_AsIs)
    if int(st) != 1 and st != IFSelect_RetDone:
        return _fail("step_transfer_failed", status=int(st))
    st = writer.Write(str(path))
    if int(st) != 1 and st != IFSelect_RetDone:
        return _fail("step_write_failed", status=int(st), path=path)
    text = Path(path).read_text(errors="replace")
    markers = {m: (m in text) for m in ADVANCED_MARKERS}
    faceted = {m: (m in text) for m in FACETED_MARKERS}
    advanced = bool(markers.get("ADVANCED_FACE")) and not faceted.get("POLY_LOOP")
    return {
        "ok": True,
        "path": str(path),
        "bytes": Path(path).stat().st_size,
        "markers": markers,
        "faceted_markers": faceted,
        "advanced_brep": advanced,
        "step_preview_head": text[:240],
    }


def _tessellate(shape, deflection: float = 0.5) -> dict:
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopAbs import TopAbs_FACE
    from OCP.TopLoc import TopLoc_Location
    from OCP.BRep import BRep_Tool
    from OCP.TopoDS import TopoDS

    BRepMesh_IncrementalMesh(shape, float(deflection))
    positions: list[float] = []
    indices: list[int] = []
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = TopoDS.Face_s(exp.Current())
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is None:
            exp.Next()
            continue
        # Collect nodes (transformed)
        base = len(positions) // 3
        trsf = loc.Transformation()
        for i in range(1, tri.NbNodes() + 1):
            p = tri.Node(i)
            p.Transform(trsf)
            positions.extend([float(p.X()), float(p.Y()), float(p.Z())])
        # Triangles — reverse if face orientation reversed
        reversed_face = face.Orientation().name == "REVERSED" if hasattr(face.Orientation(), "name") else False
        try:
            from OCP.TopAbs import TopAbs_REVERSED

            reversed_face = face.Orientation() == TopAbs_REVERSED
        except Exception:
            pass
        for t in range(1, tri.NbTriangles() + 1):
            n1, n2, n3 = tri.Triangle(t).Get()
            if reversed_face:
                indices.extend([base + n1 - 1, base + n3 - 1, base + n2 - 1])
            else:
                indices.extend([base + n1 - 1, base + n2 - 1, base + n3 - 1])
        exp.Next()
    return {
        "positions": positions,
        "indices": indices,
        "vertexCount": len(positions) // 3,
        "triangleCount": len(indices) // 3,
    }


def _count_solids(shape) -> int:
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopAbs import TopAbs_SOLID

    n = 0
    exp = TopExp_Explorer(shape, TopAbs_SOLID)
    while exp.More():
        n += 1
        exp.Next()
    return n


def cmd_make_archetype(payload: dict) -> dict:
    kind = payload.get("kind") or "box"
    params = payload.get("params") or {}
    out = payload.get("out") or payload.get("path")
    if not out:
        return _fail("need_out_path")
    try:
        shape, used = _make_shape(kind, params)
        pos = payload.get("position") or {}
        shape = _translate(shape, pos.get("x", 0), pos.get("y", 0), pos.get("z", 0))
        written = _write_step(shape, out, name=payload.get("name") or f"conkay_{used['kind']}")
        if not written.get("ok"):
            return written
        mesh = _tessellate(shape, float(payload.get("deflection") or 0.5))
        return {
            "ok": True,
            "archetype": used,
            "solids": _count_solids(shape),
            "export": written,
            "mesh": mesh,
            "honesty": {
                "kernel": "OpenCascade/OCP",
                "format": "AP214 advanced B-rep STEP",
                "not": "faceted POLY_LOOP mesh STEP",
            },
        }
    except Exception as e:
        return _fail("make_archetype_failed", error=str(e), trace=traceback.format_exc()[-800:])


def cmd_export_compound(payload: dict) -> dict:
    """Build a compound of archetypes (parts[]) and write one STEP."""
    from OCP.BRep import BRep_Builder
    from OCP.TopoDS import TopoDS_Compound

    parts = payload.get("parts") or []
    out = payload.get("out") or payload.get("path")
    if not out:
        return _fail("need_out_path")
    if not parts:
        return _fail("no_parts")
    builder = BRep_Builder()
    compound = TopoDS_Compound()
    builder.MakeCompound(compound)
    used_parts = []
    for p in parts:
        kind = p.get("kind") or "box"
        params = p.get("params") or {}
        # Infer box from AABB if mesh bounds provided
        if p.get("bbox"):
            bb = p["bbox"]
            params = {
                "dx": abs(float(bb.get("dx") or bb.get("maxX", 1) - bb.get("minX", 0))),
                "dy": abs(float(bb.get("dy") or bb.get("maxY", 1) - bb.get("minY", 0))),
                "dz": abs(float(bb.get("dz") or bb.get("maxZ", 1) - bb.get("minZ", 0))),
            }
            kind = "box"
            if params["dx"] < 1e-6:
                params["dx"] = 1.0
            if params["dy"] < 1e-6:
                params["dy"] = 1.0
            if params["dz"] < 1e-6:
                params["dz"] = 1.0
        try:
            shape, used = _make_shape(kind, params)
        except Exception as e:
            return _fail("part_shape_failed", part=p.get("id"), error=str(e))
        pos = p.get("position") or {}
        # If bbox mins given, place at min corner
        if p.get("bbox") and "minX" in p["bbox"]:
            pos = {
                "x": float(p["bbox"]["minX"]),
                "y": float(p["bbox"]["minY"]),
                "z": float(p["bbox"]["minZ"]),
            }
        shape = _translate(shape, pos.get("x", 0), pos.get("y", 0), pos.get("z", 0))
        builder.Add(compound, shape)
        used_parts.append({"id": p.get("id"), "name": p.get("name"), **used})
    written = _write_step(compound, out, name=payload.get("name") or "conkay_assembly_occ")
    if not written.get("ok"):
        return written
    mesh = _tessellate(compound, float(payload.get("deflection") or 0.5))
    return {
        "ok": True,
        "parts": used_parts,
        "solids": _count_solids(compound),
        "export": written,
        "mesh": mesh,
        "honesty": {
            "kernel": "OpenCascade/OCP",
            "note": "Compound of primitive solids (box/cylinder). Mesh-only parts mapped via AABB box when bbox provided.",
        },
    }


def cmd_import_step(payload: dict) -> dict:
    from OCP.STEPControl import STEPControl_Reader
    from OCP.IFSelect import IFSelect_RetDone

    path = payload.get("path")
    text = payload.get("step") or payload.get("text")
    keep_path = payload.get("keep_path")
    if text and not path:
        path = payload.get("tmp_path") or "/tmp/conkay_occ_import.step"
        Path(path).write_text(text)
    if not path or not Path(path).is_file():
        return _fail("need_step_path_or_text")
    reader = STEPControl_Reader()
    st = reader.ReadFile(str(path))
    if int(st) != 1 and st != IFSelect_RetDone:
        return _fail("step_read_failed", status=int(st), path=path)
    n = reader.TransferRoots()
    if n < 1:
        return _fail("step_no_roots", path=path)
    shape = reader.OneShape()
    solids = _count_solids(shape)
    step_text = Path(path).read_text(errors="replace")
    markers = {m: (m in step_text) for m in ADVANCED_MARKERS}
    faceted = {m: (m in step_text) for m in FACETED_MARKERS}
    advanced = bool(markers.get("ADVANCED_FACE")) and not faceted.get("POLY_LOOP")
    mesh = _tessellate(shape, float(payload.get("deflection") or 0.5))
    kept = None
    if keep_path:
        Path(keep_path).parent.mkdir(parents=True, exist_ok=True)
        if os.path.abspath(path) != os.path.abspath(keep_path):
            Path(keep_path).write_bytes(Path(path).read_bytes())
        kept = str(keep_path)
    return {
        "ok": True,
        "path": str(path),
        "keptPath": kept,
        "bytes": Path(path).stat().st_size,
        "solids": solids,
        "transferRoots": int(n),
        "markers": markers,
        "faceted_markers": faceted,
        "advanced_brep": advanced,
        "mesh": mesh,
        "honesty": {
            "kernel": "OpenCascade/OCP",
            "note": "B-rep STEP imported + tessellated for Unity mesh. Original B-rep kept on disk when keep_path set.",
        },
    }


def cmd_roundtrip_box(payload: dict) -> dict:
    out = payload.get("out") or "/tmp/conkay_occ_roundtrip_box.step"
    made = cmd_make_archetype(
        {
            "kind": "box",
            "params": payload.get("params") or {"dx": 10, "dy": 20, "dz": 30},
            "out": out,
            "name": "proof_box",
            "deflection": payload.get("deflection") or 0.5,
        }
    )
    if not made.get("ok"):
        return made
    imported = cmd_import_step({"path": out, "deflection": payload.get("deflection") or 0.5})
    if not imported.get("ok"):
        return imported
    return {
        "ok": True,
        "export": made["export"],
        "import": {
            "solids": imported["solids"],
            "advanced_brep": imported["advanced_brep"],
            "markers": imported["markers"],
            "faceted_markers": imported["faceted_markers"],
            "mesh": {
                "vertexCount": imported["mesh"]["vertexCount"],
                "triangleCount": imported["mesh"]["triangleCount"],
            },
        },
        "advanced_brep": bool(made["export"].get("advanced_brep") and imported.get("advanced_brep")),
        "honesty": made.get("honesty"),
    }


COMMANDS = {
    "probe": lambda p: probe(),
    "status": lambda p: probe(),
    "make_archetype": cmd_make_archetype,
    "export_compound": cmd_export_compound,
    "import_step": cmd_import_step,
    "roundtrip_box": cmd_roundtrip_box,
}


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] not in ("-", "--json"):
        cmd = argv[1]
        payload = {}
        if len(argv) >= 3:
            try:
                payload = json.loads(argv[2])
            except json.JSONDecodeError:
                # treat as path for import
                payload = {"path": argv[2], "out": argv[2] if cmd.startswith("make") else None}
        fn = COMMANDS.get(cmd)
        if not fn:
            _emit(_fail("unknown_command", command=cmd, commands=list(COMMANDS)))
            return 2
        _emit(fn(payload))
        return 0

    # JSON-lines stdin: {"cmd":"...","payload":{...}}
    raw = sys.stdin.read()
    if not raw.strip():
        _emit(probe())
        return 0
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as e:
        _emit(_fail("bad_json", error=str(e)))
        return 2
    cmd = msg.get("cmd") or msg.get("command") or "probe"
    payload = msg.get("payload") if isinstance(msg.get("payload"), dict) else msg
    fn = COMMANDS.get(cmd)
    if not fn:
        _emit(_fail("unknown_command", command=cmd, commands=list(COMMANDS)))
        return 2
    try:
        _emit(fn(payload))
        return 0
    except Exception as e:
        _emit(_fail("cli_exception", error=str(e), trace=traceback.format_exc()[-1200:]))
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
