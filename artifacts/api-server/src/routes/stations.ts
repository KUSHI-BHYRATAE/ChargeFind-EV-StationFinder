import { Router, type IRouter, type Response } from "express";
import {
  GetCitiesQueryParams,
  GetCitiesResponse,
  GetNearestStationsQueryParams,
  GetNearestStationsResponse,
  GetStationOverviewResponse,
} from "@workspace/api-zod";
import { requestChargeFind } from "../lib/chargefind-python";

const router: IRouter = Router();

function backendUnavailable(res: Response): void {
  res.status(503).json({
    error: "Station search is temporarily unavailable. Please try again.",
  });
}

router.get("/stations/overview", async (req, res): Promise<void> => {
  try {
    const response = await requestChargeFind("/stations/overview");
    if (response.status >= 500) {
      backendUnavailable(res);
      return;
    }
    if (response.status !== 200) {
      res.status(response.status).json({
        error: "Could not load station data.",
      });
      return;
    }

    const parsed = GetStationOverviewResponse.safeParse(response.body);
    if (!parsed.success) {
      req.log.error(
        { error: parsed.error.message },
        "Invalid station overview response",
      );
      res.status(502).json({ error: "Station data could not be loaded." });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Station overview request failed");
    backendUnavailable(res);
  }
});

router.get("/stations/cities", async (req, res): Promise<void> => {
  const params = GetCitiesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Enter a shorter city name." });
    return;
  }

  const query = params.data.q
    ? `?${new URLSearchParams({ q: params.data.q }).toString()}`
    : "";
  try {
    const response = await requestChargeFind(`/stations/cities${query}`);
    if (response.status >= 500) {
      backendUnavailable(res);
      return;
    }
    if (response.status !== 200) {
      res.status(response.status).json({ error: "Could not find cities." });
      return;
    }

    const parsed = GetCitiesResponse.safeParse(response.body);
    if (!parsed.success) {
      req.log.error(
        { error: parsed.error.message },
        "Invalid city suggestions response",
      );
      res.status(502).json({ error: "City suggestions could not be loaded." });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "City suggestions request failed");
    backendUnavailable(res);
  }
});

router.get("/stations/nearest", async (req, res): Promise<void> => {
  const params = GetNearestStationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({
      error: "Enter a valid latitude, longitude, and result count.",
    });
    return;
  }

  const query = new URLSearchParams({
    latitude: String(params.data.latitude),
    longitude: String(params.data.longitude),
    k: String(params.data.k),
  });
  try {
    const response = await requestChargeFind(
      `/stations/nearest?${query.toString()}`,
    );
    if (response.status >= 500) {
      backendUnavailable(res);
      return;
    }
    if (response.status !== 200) {
      res.status(response.status).json({
        error: "That location could not be searched.",
      });
      return;
    }

    const parsed = GetNearestStationsResponse.safeParse(response.body);
    if (!parsed.success) {
      req.log.error(
        { error: parsed.error.message },
        "Invalid nearest-stations response",
      );
      res.status(502).json({ error: "Station results could not be loaded." });
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Nearest station request failed");
    backendUnavailable(res);
  }
});

export default router;