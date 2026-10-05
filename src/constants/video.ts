/**
 * YouTube Shorts can be up to 3 minutes, and the Data API has no "is a Short" flag, so anything
 * 3 minutes or shorter is treated as a short video throughout the app.
 */
export const SHORT_MAX_SECONDS = 180

export const isShortVideo = (v: { durationSeconds: number }) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_SECONDS
