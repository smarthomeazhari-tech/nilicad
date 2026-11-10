function createPathTools({ r, oc, own, load, finite, ellipseEdge }) {
  const xyz = (p) => [p.X(), p.Y(), p.Z()], dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => Math.hypot(...a);
  const point = (p) => {
    if (!Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw Error("مختصات نقطه معتبر نیست");
    return p.map(finite);
  };
  function paths({ profiles }) {
    if (!Array.isArray(profiles) || profiles.length > 1e3) throw Error("فهرست مسیرها معتبر نیست");
    const out = [];
    for (const [profileIndex, profile] of profiles.entries()) {
      let edges = [];
      if (profile.brep) edges = load(profile.brep).edges.map(own);
      else if (profile.ellipse) edges = [ellipseEdge(profile.ellipse)];
      else if (profile.circle) {
        const c = profile.circle;
        const radius = finite(c.r);
        if (radius <= 0) throw Error("شعاع معتبر نیست");
        edges = [own(r.makeCircle(radius, [finite(c.center.x), 0, finite(c.center.y)], [0, 1, 0]))];
      } else {
        if (!Array.isArray(profile.segments) || profile.segments.length > 2e3) throw Error("مسیر معتبر نیست");
        const p = (q) => {
          if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) throw Error("نقطه مسیر معتبر نیست");
          return [finite(q.x), 0, finite(q.y)];
        };
        edges = profile.segments.map((s) => {
          if (s.kind === "line") return own(r.makeLine(p(s.a), p(s.b)));
          if (s.kind === "arc") return own(r.makeThreePointArc(p(s.a), p(s.m), p(s.b)));
          throw Error("نوع مسیر معتبر نیست");
        });
        if (!edges.length && profile.points?.length) {
          if (profile.points.length > 2001) throw Error("تعداد نقاط بیش از حد است");
          for (const [segmentIndex, v] of profile.points.entries()) {
            if (out.length >= 4e3) throw Error("تعداد مسیرها بیش از حد است");
            out.push({ profileIndex, segmentIndex, kind: "VERTEX", point: p(v), length: 0 });
          }
          continue;
        }
      }
      for (const [segmentIndex, edge] of edges.entries()) {
        if (out.length >= 4e3) throw Error("تعداد مسیرها بیش از حد است");
        out.push({ profileIndex, segmentIndex, kind: edge.geomType, brep: edge.serialize(), length: r.measureLength(edge), positions: Array.from(edge.meshEdges({ tolerance: 0.02, angularTolerance: 0.08 }).lines) });
      }
    }
    return { paths: out };
  }
  function inspect(payload) {
    if (payload.vertex) {
      const p2 = point(payload.vertex);
      return { kind: "VERTEX", point: p2, units: "mm", totalLength: 0, lengthFromStart: 0, remainingLength: 0, normalized: 0, parameter: null, tangent: null, normal: null, binormal: null, curvature: null, radius: null, torsion: null, start: p2, end: p2, regular: false, derivativeOrder: 0 };
    }
    let edge = load(payload.brep);
    if (!(edge instanceof r.Edge)) {
      const edges = edge.edges.map(own), i = payload.edgeIndex;
      if (!Number.isInteger(i) || i < 0 || i >= edges.length) throw Error("شناسه مسیر معتبر نیست");
      edge = edges[i];
    }
    const adaptor = own(new oc.BRepAdaptor_Curve(edge.wrapped)), first = adaptor.FirstParameter(), last = adaptor.LastParameter();
    let total = r.measureLength(edge);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first || total < 1e-9) throw Error("دامنه یا طول مسیر معتبر نیست");
    const start = xyz(own(adaptor.Value(first))), end = xyz(own(adaptor.Value(last)));
    let u, projectionDistance = 0, ambiguous = false;
    if (payload.normalized !== void 0) {
      const t = payload.normalized;
      if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > 1) throw Error("پارامتر باید بین صفر و یک باشد");
      u = first + t * (last - first);
    } else {
      const target = point(payload.position), vertex = own(r.makeVertex(target)), distance = own(new oc.BRepExtrema_DistShapeShape(vertex.wrapped, edge.wrapped));
      if (!distance.IsDone() || !distance.NbSolution()) throw Error("تصویر نقطه روی مسیر پیدا نشد");
      projectionDistance = distance.Value();
      ambiguous = distance.NbSolution() > 1;
      try {
        u = distance.ParOnEdgeS2(1).t;
      } catch {
        const nearest = xyz(own(distance.PointOnShape2(1)));
        u = norm(nearest.map((v, i) => v - start[i])) <= norm(nearest.map((v, i) => v - end[i])) ? first : last;
      }
    }
    u = Math.max(first, Math.min(last, u));
    const p = own(new oc.gp_Pnt()), v1 = own(new oc.gp_Vec()), v2 = own(new oc.gp_Vec()), v3 = own(new oc.gp_Vec());
    let order = 3;
    try {
      adaptor.D3(u, p, v1, v2, v3);
    } catch {
      order = 2;
      try {
        adaptor.D2(u, p, v1, v2);
      } catch {
        order = 1;
        adaptor.D1(u, p, v1);
      }
    }
    const position = xyz(p), d1 = xyz(v1), d2 = order >= 2 ? xyz(v2) : null, d3 = order >= 3 ? xyz(v3) : null, speed = norm(d1), regular = speed > 1e-12, tangent = regular ? d1.map((v) => v / speed) : null, c = d2 ? cross(d1, d2) : null, cn = c ? norm(c) : 0;
    const curvature = regular && d2 ? cn / speed ** 3 : null, radius = curvature > 1e-12 ? 1 / curvature : null, binormal = cn > 1e-12 ? c.map((v) => v / cn) : null, normal = binormal && tangent ? cross(binormal, tangent) : null, torsion = d3 && cn > 1e-12 ? dot(c, d3) / (cn * cn) : null;
    const tolerance = 1e-7, kind = edge.geomType;
    let from, lengthConverged = true;
    if (kind === "LINE" || kind === "CIRCLE") from = total * (u - first) / (last - first);
    else {
      const f = (t) => {
        adaptor.D1(t, p, v1);
        return norm(xyz(v1));
      };
      const simpson = (a, b, fa, fm, fb) => (b - a) * (fa + 4 * fm + fb) / 6;
      const integrate = (a, b, fa, fm, fb, whole, eps, depth) => {
        const m = (a + b) / 2, l = f((a + m) / 2), rr = f((m + b) / 2), left = simpson(a, m, fa, l, fm), right = simpson(m, b, fm, rr, fb), delta = left + right - whole;
        if (depth === 0 && Math.abs(delta) > 15 * eps) lengthConverged = false;
        if (depth === 0 || Math.abs(delta) <= 15 * eps) return left + right + delta / 15;
        return integrate(a, m, fa, l, fm, left, eps / 2, depth - 1) + integrate(m, b, fm, rr, fb, right, eps / 2, depth - 1);
      };
      const compute = (end2) => {
        if (end2 === first) return 0;
        const a = f(first), b = f(end2), m = f((first + end2) / 2);
        return integrate(first, end2, a, m, b, simpson(first, end2, a, m, b), tolerance, 18);
      };
      total = compute(last);
      from = u === last ? total : compute(u);
    }
    let degree = null, rational = null, poles = null, knots = null;
    try {
      if (kind === "BEZIER_CURVE" || kind === "BSPLINE_CURVE") {
        degree = adaptor.Degree();
        rational = adaptor.IsRational();
        poles = adaptor.NbPoles();
        if (kind === "BSPLINE_CURVE") knots = adaptor.NbKnots();
      }
    } catch {
    }
    from = Math.max(0, Math.min(total, from));
    return { kind, degree, rational, poles, knots, edgeTolerance: adaptor.Tolerance(), lengthConverged, point: position, units: "mm", parameter: u, parameterStart: first, parameterEnd: last, normalized: (u - first) / (last - first), totalLength: total, lengthFromStart: from, remainingLength: total - from, lengthFraction: from / total, lengthMethod: kind === "LINE" || kind === "CIRCLE" ? "analytic" : "adaptive integration", lengthTolerance: tolerance, tangent, orientedTangent: tangent?.map((v) => edge.orientation === "backward" ? -v : v) || null, normal, binormal, curvature, radius, torsion, curvatureCenter: normal && radius ? position.map((v, i) => v + normal[i] * radius) : null, derivatives: { first: d1, second: d2, third: d3 }, derivativeOrder: order, regular, orientation: edge.orientation, closed: edge.isClosed, periodic: edge.isPeriodic, period: edge.isPeriodic ? edge.period : null, start, end, projectionDistance, ambiguous, azimuth: tangent ? Math.atan2(tangent[2], tangent[0]) * 180 / Math.PI : null, elevation: tangent ? Math.asin(Math.max(-1, Math.min(1, tangent[1]))) * 180 / Math.PI : null };
  }
  return { paths, inspect };
}
export {
  createPathTools
};
