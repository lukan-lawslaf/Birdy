import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "./gsap-public/esm/SplitText.js";
import { DrawSVGPlugin } from "./gsap-public/esm/DrawSVGPlugin.js";
import { MorphSVGPlugin } from "./gsap-public/esm/MorphSVGPlugin.js";

// Register all GSAP plugins once
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin);
}

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, MorphSVGPlugin };
export default gsap;
