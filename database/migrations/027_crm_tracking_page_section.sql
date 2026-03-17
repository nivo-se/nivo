-- Add page_view and section_view event types for sellers page tracking
-- Used when links to /sellers are sent in CRM emails

ALTER TABLE deep_research.tracking_events
  DROP CONSTRAINT IF EXISTS tracking_events_event_type_check;

ALTER TABLE deep_research.tracking_events
  ADD CONSTRAINT tracking_events_event_type_check
  CHECK (event_type IN (
    'open',
    'click',
    'unsubscribe',
    'bounce',
    'page_view',
    'section_view'
  ));
