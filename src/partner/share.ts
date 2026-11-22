// The page a partner opens from our QR code (share.html): the planning page in its share mode.
import "../lib/oldBrowsers";
import { mount } from "svelte";
import PartnerPage from "./PartnerPage.svelte";

export default mount(PartnerPage, {
  target: document.body,
  props: { mode: "share" },
});
