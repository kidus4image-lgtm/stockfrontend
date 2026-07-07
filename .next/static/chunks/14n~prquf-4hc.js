(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,98183,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0});var r={assign:function(){return l},searchParamsToUrlQuery:function(){return s},urlQueryToSearchParams:function(){return i}};for(var o in r)Object.defineProperty(a,o,{enumerable:!0,get:r[o]});function s(e){let t={};for(let[a,r]of e.entries()){let e=t[a];void 0===e?t[a]=r:Array.isArray(e)?e.push(r):t[a]=[e,r]}return t}function n(e){return"string"==typeof e?e:("number"!=typeof e||isNaN(e))&&"boolean"!=typeof e?"":String(e)}function i(e){let t=new URLSearchParams;for(let[a,r]of Object.entries(e))if(Array.isArray(r))for(let e of r)t.append(a,n(e));else t.set(a,n(r));return t}function l(e,...t){for(let a of t){for(let t of a.keys())e.delete(t);for(let[t,r]of a.entries())e.append(t,r)}return e}},18967,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0});var r={DecodeError:function(){return g},MiddlewareNotFoundError:function(){return x},MissingStaticPage:function(){return _},NormalizeError:function(){return b},PageNotFoundError:function(){return v},SP:function(){return y},ST:function(){return h},WEB_VITALS:function(){return s},execOnce:function(){return n},getDisplayName:function(){return d},getLocationOrigin:function(){return c},getURL:function(){return f},isAbsoluteUrl:function(){return l},isResSent:function(){return u},loadGetInitialProps:function(){return m},normalizeRepeatedSlashes:function(){return p},stringifyError:function(){return T}};for(var o in r)Object.defineProperty(a,o,{enumerable:!0,get:r[o]});let s=["CLS","FCP","FID","INP","LCP","TTFB"];function n(e){let t,a=!1;return(...r)=>(a||(a=!0,t=e(...r)),t)}let i=/^[a-zA-Z][a-zA-Z\d+\-.]*?:/,l=e=>i.test(e);function c(){let{protocol:e,hostname:t,port:a}=window.location;return`${e}//${t}${a?":"+a:""}`}function f(){let{href:e}=window.location,t=c();return e.substring(t.length)}function d(e){return"string"==typeof e?e:e.displayName||e.name||"Unknown"}function u(e){return e.finished||e.headersSent}function p(e){let t=e.split("?");return t[0].replace(/\\/g,"/").replace(/\/\/+/g,"/")+(t[1]?`?${t.slice(1).join("?")}`:"")}async function m(e,t){let a=t.res||t.ctx&&t.ctx.res;if(!e.getInitialProps)return t.ctx&&t.Component?{pageProps:await m(t.Component,t.ctx)}:{};let r=await e.getInitialProps(t);if(a&&u(a))return r;if(!r)throw Object.defineProperty(Error(`"${d(e)}.getInitialProps()" should resolve to an object. But found "${r}" instead.`),"__NEXT_ERROR_CODE",{value:"E1025",enumerable:!1,configurable:!0});return r}let y="u">typeof performance,h=y&&["mark","measure","getEntriesByName"].every(e=>"function"==typeof performance[e]);class g extends Error{}class b extends Error{}class v extends Error{constructor(e){super(),this.code="ENOENT",this.name="PageNotFoundError",this.message=`Cannot find module for page: ${e}`}}class _ extends Error{constructor(e,t){super(),this.message=`Failed to load static file for page: ${e} ${t}`}}class x extends Error{constructor(){super(),this.code="ENOENT",this.message="Cannot find the middleware module"}}function T(e){return JSON.stringify({message:e.message,stack:e.stack})}},33525,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"warnOnce",{enumerable:!0,get:function(){return r}});let r=e=>{}},54858,e=>{"use strict";let t="https://stockbackend-b73s.onrender.com".replace(/\/$/,""),a="/api-proxy";function r(e){if(!e||e.startsWith(a)||e.startsWith("/api/"))return e;try{let r=new URL(e,window.location.origin);if(r.origin===t||"http://localhost:5000"===r.origin)return`${a}${r.pathname}${r.search}${r.hash}`}catch{}return e}async function o(e,t={}){let a=localStorage.getItem("token"),s={...t.headers||{}};a&&(s.Authorization=`Bearer ${a}`);let n=await fetch(r(e),{...t,headers:s});return 401!==n.status||window.location.pathname.startsWith("/login")||(localStorage.removeItem("token"),localStorage.removeItem("user"),window.location.href="/login"),n}e.s(["apiFetch",0,o,"normalizeApiRequest",0,function(e){return"string"==typeof e?r(e):e instanceof URL?r(e.toString()):"u">typeof Request&&e instanceof Request?new Request(r(e.url),e):e}])},18566,(e,t,a)=>{t.exports=e.r(76562)},7670,e=>{"use strict";function t(){for(var e,t,a=0,r="",o=arguments.length;a<o;a++)(e=arguments[a])&&(t=function e(t){var a,r,o="";if("string"==typeof t||"number"==typeof t)o+=t;else if("object"==typeof t)if(Array.isArray(t)){var s=t.length;for(a=0;a<s;a++)t[a]&&(r=e(t[a]))&&(o&&(o+=" "),o+=r)}else for(r in t)t[r]&&(o&&(o+=" "),o+=r);return o}(e))&&(r&&(r+=" "),r+=t);return r}e.s(["clsx",0,t,"default",0,t])},70319,e=>{"use strict";var t=e.i(71645),a=e.i(7670),r=e=>"number"==typeof e&&!isNaN(e),o=e=>"string"==typeof e||"function"==typeof e?e:null,s=e=>(0,t.isValidElement)(e)||"string"==typeof e||"function"==typeof e||r(e);function n(e,t,a=300){let{scrollHeight:r,style:o}=e;requestAnimationFrame(()=>{o.minHeight="initial",o.height=r+"px",o.transition=`all ${a}ms`,requestAnimationFrame(()=>{o.height="0",o.padding="0",o.margin="0",setTimeout(t,a)})})}function i({enter:e,exit:a,appendPosition:r=!1,collapse:o=!0,collapseDuration:s=300}){return function({children:i,position:l,preventExitTransition:c,done:f,nodeRef:d,isIn:u,playToast:p}){let m=r?`${e}--${l}`:e,y=r?`${a}--${l}`:a,h=(0,t.useRef)(0);return(0,t.useLayoutEffect)(()=>{let e=d.current,t=m.split(" "),a=r=>{r.target===d.current&&(p(),e.removeEventListener("animationend",a),e.removeEventListener("animationcancel",a),0===h.current&&"animationcancel"!==r.type&&e.classList.remove(...t))};e.classList.add(...t),e.addEventListener("animationend",a),e.addEventListener("animationcancel",a)},[]),(0,t.useEffect)(()=>{let e=d.current,t=()=>{e.removeEventListener("animationend",t),o?n(e,f,s):f()};u||(c?t():(h.current=1,e.className+=` ${y}`,e.addEventListener("animationend",t)))},[u]),t.default.createElement(t.default.Fragment,null,i)}}function l(e,t){return{content:c(e.content,e.props),containerId:e.props.containerId,id:e.props.toastId,theme:e.props.theme,type:e.props.type,data:e.props.data||{},isLoading:e.props.isLoading,icon:e.props.icon,reason:e.removalReason,status:t}}function c(e,a,r=!1){return(0,t.isValidElement)(e)&&"string"!=typeof e.type?(0,t.cloneElement)(e,{closeToast:a.closeToast,toastProps:a,data:a.data,isPaused:r}):"function"==typeof e?e({closeToast:a.closeToast,toastProps:a,data:a.data,isPaused:r}):e}function f({delay:e,isRunning:r,closeToast:o,type:s="default",hide:n,className:i,controlledProgress:l,progress:c,rtl:d,isIn:u,theme:p}){let m=n||l&&0===c,y={animationDuration:`${e}ms`,animationPlayState:r?"running":"paused"};l&&(y.transform=`scaleX(${c})`);let h=(0,a.default)("Toastify__progress-bar",l?"Toastify__progress-bar--controlled":"Toastify__progress-bar--animated",`Toastify__progress-bar-theme--${p}`,`Toastify__progress-bar--${s}`,{"Toastify__progress-bar--rtl":d}),g="function"==typeof i?i({rtl:d,type:s,defaultClassName:h}):(0,a.default)(h,i);return t.default.createElement("div",{className:"Toastify__progress-bar--wrp","data-hidden":m},t.default.createElement("div",{className:`Toastify__progress-bar--bg Toastify__progress-bar-theme--${p} Toastify__progress-bar--${s}`}),t.default.createElement("div",{role:"progressbar","aria-hidden":m?"true":"false","aria-label":"notification timer","aria-valuenow":l?Math.round(100*c):void 0,"aria-valuemin":0,"aria-valuemax":100,className:g,style:y,...{[l&&c>=1?"onTransitionEnd":"onAnimationEnd"]:l&&c<1?null:()=>{u&&o()}}}))}var d=1,u=()=>`${d++}`,p=new Map,m=[],y=new Set,h=e=>y.forEach(t=>t(e));function g(e,t){var a;if(t)return!!(null!=(a=p.get(t))&&a.isToastActive(e));let r=!1;return p.forEach(t=>{t.isToastActive(e)&&(r=!0)}),r}function b(e,t){s(e)&&(p.size>0||m.push({content:e,options:t}),p.forEach(a=>{a.buildToast(e,t)}))}function v(e,t){p.forEach(a=>{null!=t&&null!=t&&t.containerId&&(null==t?void 0:t.containerId)!==a.id||a.toggle(e,null==t?void 0:t.id)})}function _(e,t){return b(e,t),t.toastId}function x(e,t){var a;return{...t,type:t&&t.type||e,toastId:(a=t)&&("string"==typeof a.toastId||r(a.toastId))?a.toastId:u()}}function T(e){return(t,a)=>_(t,x(e,a))}function j(e,t){return _(e,x("default",t))}j.loading=(e,t)=>_(e,x("default",{isLoading:!0,autoClose:!1,closeOnClick:!1,closeButton:!1,draggable:!1,...t})),j.promise=function(e,{pending:t,error:a,success:r},o){let s;t&&(s="string"==typeof t?j.loading(t,o):j.loading(t.render,{...o,...t}));let n={isLoading:null,autoClose:null,closeOnClick:null,closeButton:null,draggable:null},i=(e,t,a)=>{if(null==t)return void j.dismiss(s);let r={type:e,...n,...o,data:a},i="string"==typeof t?{render:t}:t;return s?j.update(s,{...r,...i}):j(i.render,{...r,...i}),a},l="function"==typeof e?e():e;return l.then(e=>i("success",r,e)).catch(e=>i("error",a,e)),l},j.success=T("success"),j.info=T("info"),j.error=T("error"),j.warning=T("warning"),j.warn=j.warning,j.dark=(e,t)=>_(e,x("default",{theme:"dark",...t})),j.dismiss=function(e){!function(e){let t;if(!(p.size>0)){m=m.filter(t=>null!=e&&t.options.toastId!==e);return}if(null==e||"string"==typeof(t=e)||r(t))p.forEach(t=>{t.removeToast(e)});else if(e&&("containerId"in e||"id"in e)){let t=p.get(e.containerId);t?t.removeToast(e.id):p.forEach(t=>{t.removeToast(e.id)})}}(e)},j.clearWaitingQueue=(e={})=>{p.forEach(t=>{t.props.limit&&(!e.containerId||t.id===e.containerId)&&t.clearQueue()})},j.isActive=g,j.update=(e,t={})=>{let a=((e,{containerId:t})=>{var a;return null==(a=p.get(t||1))?void 0:a.toasts.get(e)})(e,t);if(a){let{props:r,content:o}=a,s={delay:100,...r,...t,toastId:t.toastId||e,updateId:u()};s.toastId!==e&&(s.staleId=e);let n=s.render||o;delete s.render,_(n,s)}},j.done=e=>{j.update(e,{progress:1})},j.onChange=function(e){return y.add(e),()=>{y.delete(e)}},j.play=e=>v(!0,e),j.pause=e=>v(!1,e);var k="u">typeof window?t.useLayoutEffect:t.useEffect,w=({theme:e,type:a,isLoading:r,...o})=>t.default.createElement("svg",{viewBox:"0 0 24 24",width:"100%",height:"100%",fill:"colored"===e?"currentColor":`var(--toastify-icon-color-${a})`,...o}),N={info:function(e){return t.default.createElement(w,{...e},t.default.createElement("path",{d:"M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z"}))},warning:function(e){return t.default.createElement(w,{...e},t.default.createElement("path",{d:"M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.251-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.84 8.06c-.057.581-.408.943-.897.943-.49 0-.84-.367-.896-.942l-.84-8.065c-.057-.624.25-1.095.779-1.095h1.91c.528.005.84.476.784 1.1z"}))},success:function(e){return t.default.createElement(w,{...e},t.default.createElement("path",{d:"M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"}))},error:function(e){return t.default.createElement(w,{...e},t.default.createElement("path",{d:"M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"}))},spinner:function(){return t.default.createElement("div",{className:"Toastify__spinner"})}},P=e=>{let{isRunning:r,preventExitTransition:o,toastRef:s,eventHandlers:n,playToast:i}=function(e){var a,r;let[o,s]=(0,t.useState)(!1),[n,i]=(0,t.useState)(!1),l=(0,t.useRef)(null),c=(0,t.useRef)({start:0,delta:0,removalDistance:0,canCloseOnClick:!0,canDrag:!1,didMove:!1}).current,{autoClose:f,pauseOnHover:d,closeToast:u,onClick:m,closeOnClick:y}=e;function h(){s(!0)}function g(){s(!1)}function b(t){let a=l.current;if(c.canDrag&&a){c.didMove=!0,o&&g(),"x"===e.draggableDirection?c.delta=t.clientX-c.start:c.delta=t.clientY-c.start,c.start!==t.clientX&&(c.canCloseOnClick=!1);let r="x"===e.draggableDirection?`${c.delta}px, var(--y)`:`0, calc(${c.delta}px + var(--y))`;a.style.transform=`translate3d(${r},0)`,a.style.opacity=`${1-Math.abs(c.delta/c.removalDistance)}`}}function v(){document.removeEventListener("pointermove",b),document.removeEventListener("pointerup",v);let t=l.current;if(c.canDrag&&c.didMove&&t){if(c.canDrag=!1,Math.abs(c.delta)>c.removalDistance){i(!0),e.closeToast(!0),e.collapseAll();return}t.style.transition="transform 0.2s, opacity 0.2s",t.style.removeProperty("transform"),t.style.removeProperty("opacity")}}a={id:e.toastId,containerId:e.containerId,fn:s},null==(r=p.get(a.containerId||1))||r.setToggle(a.id,a.fn),(0,t.useEffect)(()=>{if(e.pauseOnFocusLoss)return document.hasFocus()||g(),window.addEventListener("focus",h),window.addEventListener("blur",g),()=>{window.removeEventListener("focus",h),window.removeEventListener("blur",g)}},[e.pauseOnFocusLoss]);let _={onPointerDown:function(t){if(!0===e.draggable||e.draggable===t.pointerType){c.didMove=!1,document.addEventListener("pointermove",b),document.addEventListener("pointerup",v);let a=l.current;c.canCloseOnClick=!0,c.canDrag=!0,a.style.transition="none","x"===e.draggableDirection?(c.start=t.clientX,c.removalDistance=a.offsetWidth*(e.draggablePercent/100)):(c.start=t.clientY,c.removalDistance=a.offsetHeight*(80===e.draggablePercent?1.5*e.draggablePercent:e.draggablePercent)/100)}},onPointerUp:function(t){let{top:a,bottom:r,left:o,right:s}=l.current.getBoundingClientRect();"mouse"===t.pointerType&&e.pauseOnHover&&t.clientX>=o&&t.clientX<=s&&t.clientY>=a&&t.clientY<=r?g():h()}};return f&&d&&(_.onMouseEnter=g,e.stacked||(_.onMouseLeave=h)),y&&(_.onClick=e=>{m&&m(e),c.canCloseOnClick&&u(!0)}),{playToast:h,pauseToast:g,isRunning:o,preventExitTransition:n,toastRef:l,eventHandlers:_}}(e),{closeButton:l,children:d,autoClose:u,onClick:m,type:y,hideProgressBar:h,closeToast:g,transition:b,position:v,className:_,style:x,progressClassName:T,updateId:j,role:k,progress:w,rtl:P,toastId:E,deleteToast:I,isIn:S,isLoading:C,closeOnClick:O,theme:$,ariaLabel:L}=e,R=(0,a.default)("Toastify__toast",`Toastify__toast-theme--${$}`,`Toastify__toast--${y}`,{"Toastify__toast--rtl":P},{"Toastify__toast--close-on-click":O}),A="function"==typeof _?_({rtl:P,position:v,type:y,defaultClassName:R}):(0,a.default)(R,_),D=function({theme:e,type:a,isLoading:r,icon:o}){let s=null,n={theme:e,type:a};return!1===o||("function"==typeof o?s=o({...n,isLoading:r}):(0,t.isValidElement)(o)?s=(0,t.cloneElement)(o,n):r?s=N.spinner():a in N&&(s=N[a](n))),s}(e),M=!!w||!u,z={closeToast:g,type:y,theme:$},F=null;return!1===l||(F="function"==typeof l?l(z):(0,t.isValidElement)(l)?(0,t.cloneElement)(l,z):function({closeToast:e,theme:a,ariaLabel:r="close"}){return t.default.createElement("button",{className:`Toastify__close-button Toastify__close-button--${a}`,type:"button",onClick:t=>{t.stopPropagation(),e(!0)},"aria-label":r},t.default.createElement("svg",{"aria-hidden":"true",viewBox:"0 0 14 16"},t.default.createElement("path",{fillRule:"evenodd",d:"M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"})))}(z)),t.default.createElement(b,{isIn:S,done:I,position:v,preventExitTransition:o,nodeRef:s,playToast:i},t.default.createElement("div",{id:E,tabIndex:0,onClick:m,"data-in":S,className:A,...n,style:x,ref:s,...S&&{role:k,"aria-label":L}},null!=D&&t.default.createElement("div",{className:(0,a.default)("Toastify__toast-icon",{"Toastify--animate-icon Toastify__zoom-enter":!C})},D),c(d,e,!r),F,!e.customProgressBar&&t.default.createElement(f,{...j&&!M?{key:`p-${j}`}:{},rtl:P,theme:$,delay:u,isRunning:r,isIn:S,closeToast:g,hide:h,type:y,className:T,controlledProgress:M,progress:w||0})))},E=(e,t=!1)=>({enter:`Toastify--animate Toastify__${e}-enter`,exit:`Toastify--animate Toastify__${e}-exit`,appendPosition:t}),I=i(E("bounce",!0)),S=i(E("slide",!0)),C=i(E("zoom")),O=i(E("flip")),$={position:"top-right",transition:I,autoClose:5e3,closeButton:!0,pauseOnHover:!0,pauseOnFocusLoss:!0,draggable:"touch",draggablePercent:80,draggableDirection:"x",role:"alert",theme:"light","aria-label":"Notifications Alt+T",hotKeys:e=>e.altKey&&"KeyT"===e.code};function L(e){let n={...$,...e},i=e.stacked,[c,f]=(0,t.useState)(!0),d=(0,t.useRef)(null),{getToastToRender:u,isToastActive:y,count:v}=function(e){var a;let n,{subscribe:i,getSnapshot:c,setProps:f}=(0,t.useRef)((n=e.containerId||1,{subscribe(t){let a,i,c,f,d,u,y,g,v,_,x,T=(a=1,i=0,c=[],f=[],d=e,u=new Map,y=new Set,g=()=>{f=Array.from(u.values()),y.forEach(e=>e())},v=e=>{var t,a;e.isActive&&(null==(a=null==(t=e.props)?void 0:t.onClose)||a.call(t,e.removalReason),e.isActive=!1,h(l(e,"removed")))},_=e=>{if(null==e)u.forEach(v);else{let t=u.get(e);t&&v(t)}g()},x=e=>{var t,a;let{toastId:r,updateId:o}=e.props,s=null==o;e.staleId&&u.delete(e.staleId),e.isActive=!0,u.set(r,e),g(),h(l(e,s?"added":"updated")),s&&(null==(a=(t=e.props).onOpen)||a.call(t))},{id:n,props:d,observe:e=>(y.add(e),()=>y.delete(e)),toggle:(e,t)=>{u.forEach(a=>{var r;(null==t||t===a.props.toastId)&&(null==(r=a.toggle)||r.call(a,e))})},removeToast:_,toasts:u,clearQueue:()=>{i-=c.length,c=[]},buildToast:(e,t)=>{let l,f;if((({containerId:e,toastId:t,updateId:a})=>{let r=u.has(t)&&null==a;return(e?e!==n:1!==n)||r})(t))return;let{toastId:p,updateId:m,data:y,staleId:h,delay:b}=t,v=null==m;v&&i++;let T={...d,style:d.toastStyle,key:a++,...Object.fromEntries(Object.entries(t).filter(([e,t])=>null!=t)),toastId:p,updateId:m,data:y,isIn:!1,className:o(t.className||d.toastClassName),progressClassName:o(t.progressClassName||d.progressClassName),autoClose:!t.isLoading&&(l=t.autoClose,f=d.autoClose,!1===l||r(l)&&l>0?l:f),closeToast(e){let t=u.get(p);t&&(t.removalReason=e,_(p))},deleteToast(){if(null!=u.get(p)){if(u.delete(p),--i<0&&(i=0),c.length>0)return void x(c.shift());g()}}};T.closeButton=d.closeButton,!1===t.closeButton||s(t.closeButton)?T.closeButton=t.closeButton:!0===t.closeButton&&(T.closeButton=!s(d.closeButton)||d.closeButton);let j={content:e,props:T,staleId:h};d.limit&&d.limit>0&&i>d.limit&&v?c.push(j):r(b)?setTimeout(()=>{x(j)},b):x(j)},setProps(e){d=e},setToggle:(e,t)=>{let a=u.get(e);a&&(a.toggle=t)},isToastActive:e=>{var t;return null==(t=u.get(e))?void 0:t.isActive},getSnapshot:()=>f});p.set(n,T);let j=T.observe(t);return m.forEach(e=>b(e.content,e.options)),m=[],()=>{j(),p.delete(n)}},setProps(e){var t;null==(t=p.get(n))||t.setProps(e)},getSnapshot(){var e;return null==(e=p.get(n))?void 0:e.getSnapshot()}})).current;f(e);let d=null==(a=(0,t.useSyncExternalStore)(i,c,c))?void 0:a.slice();return{getToastToRender:function(t){if(!d)return[];let a=new Map;return e.newestOnTop&&d.reverse(),d.forEach(e=>{let{position:t}=e.props;a.has(t)||a.set(t,[]),a.get(t).push(e)}),Array.from(a,e=>t(e[0],e[1]))},isToastActive:g,count:null==d?void 0:d.length}}(n),{className:_,style:x,rtl:T,containerId:w,hotKeys:N}=n;function E(){i&&(f(!0),j.play())}return k(()=>{var e;if(i){let t=d.current.querySelectorAll('[data-in="true"]'),a=null==(e=n.position)?void 0:e.includes("top"),r=0,o=0;Array.from(t).reverse().forEach((e,t)=>{e.classList.add("Toastify__toast--stacked"),t>0&&(e.dataset.collapsed=`${c}`),e.dataset.pos||(e.dataset.pos=a?"top":"bot");let s=r*(c?.2:1)+(c?0:12*t),n=Math.max(.5,1-(c?o:0));e.style.setProperty("--y",`${a?s:-1*s}px`),e.style.setProperty("--g","12"),e.style.setProperty("--s",`${n}`),r+=e.offsetHeight,o+=.025})}},[c,v,i]),(0,t.useEffect)(()=>{function e(e){var t;let a=d.current;N(e)&&(null==(t=null==a?void 0:a.querySelector('[tabIndex="0"]'))||t.focus(),f(!1),j.pause()),"Escape"===e.key&&(document.activeElement===a||null!=a&&a.contains(document.activeElement))&&(f(!0),j.play())}return document.addEventListener("keydown",e),()=>{document.removeEventListener("keydown",e)}},[N]),t.default.createElement("section",{ref:d,className:"Toastify",id:w,onMouseEnter:()=>{i&&(f(!1),j.pause())},onMouseLeave:E,"aria-live":"polite","aria-atomic":"false","aria-relevant":"additions text","aria-label":n["aria-label"]},u((e,r)=>{var s;let n,l=r.length?{...x}:{...x,pointerEvents:"none"};return t.default.createElement("div",{tabIndex:-1,className:(s=e,n=(0,a.default)("Toastify__toast-container",`Toastify__toast-container--${s}`,{"Toastify__toast-container--rtl":T}),"function"==typeof _?_({position:s,rtl:T,defaultClassName:n}):(0,a.default)(n,o(_))),"data-stacked":i,style:l,key:`c-${e}`},r.map(({content:e,props:a})=>t.default.createElement(P,{...a,stacked:i,collapseAll:E,isIn:y(a.toastId,a.containerId),key:`t-${a.key}`},e)))}))}var R=`:root {
  --toastify-color-light: #fff;
  --toastify-color-dark: #121212;
  --toastify-color-info: #3498db;
  --toastify-color-success: #07bc0c;
  --toastify-color-warning: #f1c40f;
  --toastify-color-error: hsl(6, 78%, 57%);
  --toastify-color-transparent: rgba(255, 255, 255, 0.7);

  --toastify-icon-color-info: var(--toastify-color-info);
  --toastify-icon-color-success: var(--toastify-color-success);
  --toastify-icon-color-warning: var(--toastify-color-warning);
  --toastify-icon-color-error: var(--toastify-color-error);

  --toastify-container-width: fit-content;
  --toastify-toast-width: 320px;
  --toastify-toast-offset: 16px;
  --toastify-toast-top: max(var(--toastify-toast-offset), env(safe-area-inset-top));
  --toastify-toast-right: max(var(--toastify-toast-offset), env(safe-area-inset-right));
  --toastify-toast-left: max(var(--toastify-toast-offset), env(safe-area-inset-left));
  --toastify-toast-bottom: max(var(--toastify-toast-offset), env(safe-area-inset-bottom));
  --toastify-toast-background: #fff;
  --toastify-toast-padding: 14px;
  --toastify-toast-min-height: 64px;
  --toastify-toast-max-height: 800px;
  --toastify-toast-bd-radius: 6px;
  --toastify-toast-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
  --toastify-font-family: sans-serif;
  --toastify-z-index: 9999;
  --toastify-text-color-light: #757575;
  --toastify-text-color-dark: #fff;

  /* Used only for colored theme */
  --toastify-text-color-info: #fff;
  --toastify-text-color-success: #fff;
  --toastify-text-color-warning: #fff;
  --toastify-text-color-error: #fff;

  --toastify-spinner-color: #616161;
  --toastify-spinner-color-empty-area: #e0e0e0;
  --toastify-color-progress-light: linear-gradient(to right, #4cd964, #5ac8fa, #007aff, #34aadc, #5856d6, #ff2d55);
  --toastify-color-progress-dark: #bb86fc;
  --toastify-color-progress-info: var(--toastify-color-info);
  --toastify-color-progress-success: var(--toastify-color-success);
  --toastify-color-progress-warning: var(--toastify-color-warning);
  --toastify-color-progress-error: var(--toastify-color-error);
  /* used to control the opacity of the progress trail */
  --toastify-color-progress-bgo: 0.2;
}

.Toastify__toast-container {
  z-index: var(--toastify-z-index);
  -webkit-transform: translate3d(0, 0, var(--toastify-z-index));
  position: fixed;
  width: var(--toastify-container-width);
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.Toastify__toast-container--top-left {
  top: var(--toastify-toast-top);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--top-center {
  top: var(--toastify-toast-top);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--top-right {
  top: var(--toastify-toast-top);
  right: var(--toastify-toast-right);
  align-items: end;
}
.Toastify__toast-container--bottom-left {
  bottom: var(--toastify-toast-bottom);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--bottom-center {
  bottom: var(--toastify-toast-bottom);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--bottom-right {
  bottom: var(--toastify-toast-bottom);
  right: var(--toastify-toast-right);
  align-items: end;
}

.Toastify__toast {
  --y: 0px;
  position: relative;
  touch-action: none;
  width: var(--toastify-toast-width);
  min-height: var(--toastify-toast-min-height);
  box-sizing: border-box;
  margin-bottom: 1rem;
  padding: var(--toastify-toast-padding);
  border-radius: var(--toastify-toast-bd-radius);
  box-shadow: var(--toastify-toast-shadow);
  max-height: var(--toastify-toast-max-height);
  font-family: var(--toastify-font-family);
  /* webkit only issue #791 */
  z-index: 0;
  /* inner swag */
  display: flex;
  flex: 1 auto;
  align-items: center;
  word-break: break-word;
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container {
    width: 100vw;
    left: env(safe-area-inset-left);
    margin: 0;
  }
  .Toastify__toast-container--top-left,
  .Toastify__toast-container--top-center,
  .Toastify__toast-container--top-right {
    top: env(safe-area-inset-top);
    transform: translateX(0);
  }
  .Toastify__toast-container--bottom-left,
  .Toastify__toast-container--bottom-center,
  .Toastify__toast-container--bottom-right {
    bottom: env(safe-area-inset-bottom);
    transform: translateX(0);
  }
  .Toastify__toast-container--rtl {
    right: env(safe-area-inset-right);
    left: initial;
  }
  .Toastify__toast {
    --toastify-toast-width: 100%;
    margin-bottom: 0;
    border-radius: 0;
  }
}

.Toastify__toast-container[data-stacked='true'] {
  width: var(--toastify-toast-width);
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container[data-stacked='true'] {
    width: 100vw;
  }
}

.Toastify__toast--stacked {
  position: absolute;
  width: 100%;
  transform: translate3d(0, var(--y), 0) scale(var(--s));
  transition: transform 0.3s;
}

.Toastify__toast--stacked[data-collapsed] .Toastify__toast-body,
.Toastify__toast--stacked[data-collapsed] .Toastify__close-button {
  transition: opacity 0.1s;
}

.Toastify__toast--stacked[data-collapsed='false'] {
  overflow: visible;
}

.Toastify__toast--stacked[data-collapsed='true']:not(:last-child) > * {
  opacity: 0;
}

.Toastify__toast--stacked:after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: calc(var(--g) * 1px);
  bottom: 100%;
}

.Toastify__toast--stacked[data-pos='top'] {
  top: 0;
}

.Toastify__toast--stacked[data-pos='bot'] {
  bottom: 0;
}

.Toastify__toast--stacked[data-pos='bot'].Toastify__toast--stacked:before {
  transform-origin: top;
}

.Toastify__toast--stacked[data-pos='top'].Toastify__toast--stacked:before {
  transform-origin: bottom;
}

.Toastify__toast--stacked:before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  transform: scaleY(3);
  z-index: -1;
}

.Toastify__toast--rtl {
  direction: rtl;
}

.Toastify__toast--close-on-click {
  cursor: pointer;
}

.Toastify__toast-icon {
  margin-inline-end: 10px;
  width: 22px;
  flex-shrink: 0;
  display: flex;
}

.Toastify--animate {
  animation-fill-mode: both;
  animation-duration: 0.5s;
}

.Toastify--animate-icon {
  animation-fill-mode: both;
  animation-duration: 0.3s;
}

.Toastify__toast-theme--dark {
  background: var(--toastify-color-dark);
  color: var(--toastify-text-color-dark);
}

.Toastify__toast-theme--light {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--default {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--info {
  color: var(--toastify-text-color-info);
  background: var(--toastify-color-info);
}

.Toastify__toast-theme--colored.Toastify__toast--success {
  color: var(--toastify-text-color-success);
  background: var(--toastify-color-success);
}

.Toastify__toast-theme--colored.Toastify__toast--warning {
  color: var(--toastify-text-color-warning);
  background: var(--toastify-color-warning);
}

.Toastify__toast-theme--colored.Toastify__toast--error {
  color: var(--toastify-text-color-error);
  background: var(--toastify-color-error);
}

.Toastify__progress-bar-theme--light {
  background: var(--toastify-color-progress-light);
}

.Toastify__progress-bar-theme--dark {
  background: var(--toastify-color-progress-dark);
}

.Toastify__progress-bar--info {
  background: var(--toastify-color-progress-info);
}

.Toastify__progress-bar--success {
  background: var(--toastify-color-progress-success);
}

.Toastify__progress-bar--warning {
  background: var(--toastify-color-progress-warning);
}

.Toastify__progress-bar--error {
  background: var(--toastify-color-progress-error);
}

.Toastify__progress-bar-theme--colored.Toastify__progress-bar--info,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--success,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--warning,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--error {
  background: var(--toastify-color-transparent);
}

.Toastify__close-button {
  color: #fff;
  position: absolute;
  top: 6px;
  right: 6px;
  background: transparent;
  outline: none;
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
  transition: 0.3s ease;
  z-index: 1;
}

.Toastify__toast--rtl .Toastify__close-button {
  left: 6px;
  right: unset;
}

.Toastify__close-button--light {
  color: #000;
  opacity: 0.3;
}

.Toastify__close-button > svg {
  fill: currentColor;
  height: 16px;
  width: 14px;
}

.Toastify__close-button:hover,
.Toastify__close-button:focus {
  opacity: 1;
}

@keyframes Toastify__trackProgress {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

.Toastify__progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  opacity: 0.7;
  transform-origin: left;
}

.Toastify__progress-bar--animated {
  animation: Toastify__trackProgress linear 1 forwards;
}

.Toastify__progress-bar--controlled {
  transition: transform 0.2s;
}

.Toastify__progress-bar--rtl {
  right: 0;
  left: initial;
  transform-origin: right;
  border-bottom-left-radius: initial;
}

.Toastify__progress-bar--wrp {
  position: absolute;
  overflow: hidden;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  border-bottom-left-radius: var(--toastify-toast-bd-radius);
  border-bottom-right-radius: var(--toastify-toast-bd-radius);
}

.Toastify__progress-bar--wrp[data-hidden='true'] {
  opacity: 0;
}

.Toastify__progress-bar--bg {
  opacity: var(--toastify-color-progress-bgo);
  width: 100%;
  height: 100%;
}

.Toastify__spinner {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: var(--toastify-spinner-color-empty-area);
  border-right-color: var(--toastify-spinner-color);
  animation: Toastify__spin 0.65s linear infinite;
}

@keyframes Toastify__bounceInRight {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(-25px, 0, 0);
  }
  75% {
    transform: translate3d(10px, 0, 0);
  }
  90% {
    transform: translate3d(-5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutRight {
  20% {
    opacity: 1;
    transform: translate3d(-20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInLeft {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(-3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(25px, 0, 0);
  }
  75% {
    transform: translate3d(-10px, 0, 0);
  }
  90% {
    transform: translate3d(5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutLeft {
  20% {
    opacity: 1;
    transform: translate3d(20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(-2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInUp {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(0, 3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, -20px, 0);
  }
  75% {
    transform: translate3d(0, 10px, 0);
  }
  90% {
    transform: translate3d(0, -5px, 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes Toastify__bounceOutUp {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, -2000px, 0);
  }
}

@keyframes Toastify__bounceInDown {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(0, -3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, 25px, 0);
  }
  75% {
    transform: translate3d(0, -10px, 0);
  }
  90% {
    transform: translate3d(0, 5px, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutDown {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, 2000px, 0);
  }
}

.Toastify__bounce-enter--top-left,
.Toastify__bounce-enter--bottom-left {
  animation-name: Toastify__bounceInLeft;
}

.Toastify__bounce-enter--top-right,
.Toastify__bounce-enter--bottom-right {
  animation-name: Toastify__bounceInRight;
}

.Toastify__bounce-enter--top-center {
  animation-name: Toastify__bounceInDown;
}

.Toastify__bounce-enter--bottom-center {
  animation-name: Toastify__bounceInUp;
}

.Toastify__bounce-exit--top-left,
.Toastify__bounce-exit--bottom-left {
  animation-name: Toastify__bounceOutLeft;
}

.Toastify__bounce-exit--top-right,
.Toastify__bounce-exit--bottom-right {
  animation-name: Toastify__bounceOutRight;
}

.Toastify__bounce-exit--top-center {
  animation-name: Toastify__bounceOutUp;
}

.Toastify__bounce-exit--bottom-center {
  animation-name: Toastify__bounceOutDown;
}

@keyframes Toastify__zoomIn {
  from {
    opacity: 0;
    transform: scale3d(0.3, 0.3, 0.3);
  }
  50% {
    opacity: 1;
  }
}

@keyframes Toastify__zoomOut {
  from {
    opacity: 1;
  }
  50% {
    opacity: 0;
    transform: translate3d(0, var(--y), 0) scale3d(0.3, 0.3, 0.3);
  }
  to {
    opacity: 0;
  }
}

.Toastify__zoom-enter {
  animation-name: Toastify__zoomIn;
}

.Toastify__zoom-exit {
  animation-name: Toastify__zoomOut;
}

@keyframes Toastify__flipIn {
  from {
    transform: perspective(400px) rotate3d(1, 0, 0, 90deg);
    animation-timing-function: ease-in;
    opacity: 0;
  }
  40% {
    transform: perspective(400px) rotate3d(1, 0, 0, -20deg);
    animation-timing-function: ease-in;
  }
  60% {
    transform: perspective(400px) rotate3d(1, 0, 0, 10deg);
    opacity: 1;
  }
  80% {
    transform: perspective(400px) rotate3d(1, 0, 0, -5deg);
  }
  to {
    transform: perspective(400px);
  }
}

@keyframes Toastify__flipOut {
  from {
    transform: translate3d(0, var(--y), 0) perspective(400px);
  }
  30% {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, -20deg);
    opacity: 1;
  }
  to {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, 90deg);
    opacity: 0;
  }
}

.Toastify__flip-enter {
  animation-name: Toastify__flipIn;
}

.Toastify__flip-exit {
  animation-name: Toastify__flipOut;
}

@keyframes Toastify__slideInRight {
  from {
    transform: translate3d(110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInLeft {
  from {
    transform: translate3d(-110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInUp {
  from {
    transform: translate3d(0, 110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInDown {
  from {
    transform: translate3d(0, -110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideOutRight {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutLeft {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(-110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutDown {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, 500px, 0);
  }
}

@keyframes Toastify__slideOutUp {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, -500px, 0);
  }
}

.Toastify__slide-enter--top-left,
.Toastify__slide-enter--bottom-left {
  animation-name: Toastify__slideInLeft;
}

.Toastify__slide-enter--top-right,
.Toastify__slide-enter--bottom-right {
  animation-name: Toastify__slideInRight;
}

.Toastify__slide-enter--top-center {
  animation-name: Toastify__slideInDown;
}

.Toastify__slide-enter--bottom-center {
  animation-name: Toastify__slideInUp;
}

.Toastify__slide-exit--top-left,
.Toastify__slide-exit--bottom-left {
  animation-name: Toastify__slideOutLeft;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-right,
.Toastify__slide-exit--bottom-right {
  animation-name: Toastify__slideOutRight;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-center {
  animation-name: Toastify__slideOutUp;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--bottom-center {
  animation-name: Toastify__slideOutDown;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

@keyframes Toastify__spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`,A=new Map;e.s(["Bounce",0,I,"Flip",0,O,"Icons",0,N,"Slide",0,S,"ToastContainer",0,function(e){var a;return k(()=>{if(!R||"u"<typeof document)return;let e=document,t=A.get(e);if(t){a&&t.setAttribute("nonce",a);return}let r=e.createElement("style");r.textContent=R,a&&r.setAttribute("nonce",a),e.head.appendChild(r),A.set(e,r)},[a=e.nonce]),t.default.createElement(L,{...e})},"Zoom",0,C,"collapseToast",0,n,"cssTransition",0,i,"toast",0,j])},95057,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0});var r={formatUrl:function(){return i},formatWithValidation:function(){return c},urlObjectKeys:function(){return l}};for(var o in r)Object.defineProperty(a,o,{enumerable:!0,get:r[o]});let s=e.r(90809)._(e.r(98183)),n=/https?|ftp|gopher|file/;function i(e){let{auth:t,hostname:a}=e,r=e.protocol||"",o=e.pathname||"",i=e.hash||"",l=e.query||"",c=!1;t=t?encodeURIComponent(t).replace(/%3A/i,":")+"@":"",e.host?c=t+e.host:a&&(c=t+(~a.indexOf(":")?`[${a}]`:a),e.port&&(c+=":"+e.port)),l&&"object"==typeof l&&(l=String(s.urlQueryToSearchParams(l)));let f=e.search||l&&`?${l}`||"";return r&&!r.endsWith(":")&&(r+=":"),e.slashes||(!r||n.test(r))&&!1!==c?(c="//"+(c||""),o&&"/"!==o[0]&&(o="/"+o)):c||(c=""),i&&"#"!==i[0]&&(i="#"+i),f&&"?"!==f[0]&&(f="?"+f),o=o.replace(/[?#]/g,encodeURIComponent),f=f.replace("#","%23"),`${r}${c}${o}${f}${i}`}let l=["auth","hash","host","hostname","href","path","pathname","port","protocol","query","search","slashes"];function c(e){return i(e)}},18581,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"useMergedRef",{enumerable:!0,get:function(){return o}});let r=e.r(71645);function o(e,t){let a=(0,r.useRef)(null),o=(0,r.useRef)(null);return(0,r.useCallback)(r=>{if(null===r){let e=a.current;e&&(a.current=null,e());let t=o.current;t&&(o.current=null,t())}else e&&(a.current=s(e,r)),t&&(o.current=s(t,r))},[e,t])}function s(e,t){if("function"!=typeof e)return e.current=t,()=>{e.current=null};{let a=e(t);return"function"==typeof a?a:()=>e(null)}}("function"==typeof a.default||"object"==typeof a.default&&null!==a.default)&&void 0===a.default.__esModule&&(Object.defineProperty(a.default,"__esModule",{value:!0}),Object.assign(a.default,a),t.exports=a.default)},73668,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"isLocalURL",{enumerable:!0,get:function(){return s}});let r=e.r(18967),o=e.r(52817);function s(e){if(!(0,r.isAbsoluteUrl)(e))return!0;try{let t=(0,r.getLocationOrigin)(),a=new URL(e,t);return a.origin===t&&(0,o.hasBasePath)(a.pathname)}catch(e){return!1}}},84508,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"errorOnce",{enumerable:!0,get:function(){return r}});let r=e=>{}},22016,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0});var r={default:function(){return g},useLinkStatus:function(){return v}};for(var o in r)Object.defineProperty(a,o,{enumerable:!0,get:r[o]});let s=e.r(90809),n=e.r(43476),i=s._(e.r(71645)),l=e.r(95057),c=e.r(8372),f=e.r(18581),d=e.r(18967),u=e.r(5550);e.r(33525);let p=e.r(88540),m=e.r(91949),y=e.r(73668),h=e.r(9396);function g(t){var a,r;let o,s,g,[v,_]=(0,i.useOptimistic)(m.IDLE_LINK_STATUS),x=(0,i.useRef)(null),{href:T,as:j,children:k,prefetch:w=null,passHref:N,replace:P,shallow:E,scroll:I,onClick:S,onMouseEnter:C,onTouchStart:O,legacyBehavior:$=!1,onNavigate:L,transitionTypes:R,ref:A,unstable_dynamicOnHover:D,...M}=t;o=k,$&&("string"==typeof o||"number"==typeof o)&&(o=(0,n.jsx)("a",{children:o}));let z=i.default.useContext(c.AppRouterContext),F=!1!==w,U=!1!==w?null===(r=w)||"auto"===r?h.FetchStrategy.PPR:h.FetchStrategy.Full:h.FetchStrategy.PPR,B="string"==typeof(a=j||T)?a:(0,l.formatUrl)(a);if($){if(o?.$$typeof===Symbol.for("react.lazy"))throw Object.defineProperty(Error("`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag."),"__NEXT_ERROR_CODE",{value:"E863",enumerable:!1,configurable:!0});s=i.default.Children.only(o)}let W=$?s&&"object"==typeof s&&s.ref:A,K=i.default.useCallback(e=>(null!==z&&(x.current=(0,m.mountLinkInstance)(e,B,z,U,F,_)),()=>{x.current&&((0,m.unmountLinkForCurrentNavigation)(x.current),x.current=null),(0,m.unmountPrefetchableInstance)(e)}),[F,B,z,U,_]),X={ref:(0,f.useMergedRef)(K,W),onClick(t){$||"function"!=typeof S||S(t),$&&s.props&&"function"==typeof s.props.onClick&&s.props.onClick(t),!z||t.defaultPrevented||function(t,a,r,o,s,n,l){if("u">typeof window){let c,{nodeName:f}=t.currentTarget;if("A"===f.toUpperCase()&&((c=t.currentTarget.getAttribute("target"))&&"_self"!==c||t.metaKey||t.ctrlKey||t.shiftKey||t.altKey||t.nativeEvent&&2===t.nativeEvent.which)||t.currentTarget.hasAttribute("download"))return;if(!(0,y.isLocalURL)(a)){o&&(t.preventDefault(),location.replace(a));return}if(t.preventDefault(),n){let e=!1;if(n({preventDefault:()=>{e=!0}}),e)return}let{dispatchNavigateAction:d}=e.r(99781);i.default.startTransition(()=>{d(a,o?"replace":"push",!1===s?p.ScrollBehavior.NoScroll:p.ScrollBehavior.Default,r.current,l)})}}(t,B,x,P,I,L,R)},onMouseEnter(e){$||"function"!=typeof C||C(e),$&&s.props&&"function"==typeof s.props.onMouseEnter&&s.props.onMouseEnter(e),z&&F&&(0,m.onNavigationIntent)(e.currentTarget,!0===D)},onTouchStart:function(e){$||"function"!=typeof O||O(e),$&&s.props&&"function"==typeof s.props.onTouchStart&&s.props.onTouchStart(e),z&&F&&(0,m.onNavigationIntent)(e.currentTarget,!0===D)}};return(0,d.isAbsoluteUrl)(B)?X.href=B:$&&!N&&("a"!==s.type||"href"in s.props)||(X.href=(0,u.addBasePath)(B)),g=$?i.default.cloneElement(s,X):(0,n.jsx)("a",{...M,...X,children:o}),(0,n.jsx)(b.Provider,{value:v,children:g})}e.r(84508);let b=(0,i.createContext)(m.IDLE_LINK_STATUS),v=()=>(0,i.useContext)(b);("function"==typeof a.default||"object"==typeof a.default&&null!==a.default)&&void 0===a.default.__esModule&&(Object.defineProperty(a.default,"__esModule",{value:!0}),Object.assign(a.default,a),t.exports=a.default)},69052,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(54858);let o={primary:"#174f49",secondary:"#475569",nav:"#38bdf8",badge:"#174f49",tabIndicator:"#174f49"},s="astinka_ui_theme",n="astinka_doc_templates";function i(e,t){try{let a=localStorage.getItem(e);if(!a)return t;let r=JSON.parse(a);if(Array.isArray(t))return Array.isArray(r)?r:t;return"object"==typeof r&&null!==r?{...t,...r}:t}catch{return t}}function l(e,t){localStorage.setItem(e,JSON.stringify(t))}let c={withholdPercent:2,creditGraceDays:30,cashGraceDays:3,expiryNotificationDays:60,expiryDisplayType:"long",blockDirectInvoice:!1,companyName:"Nexlify",companyLogo:"",companyAddress:"",companyPhone:"",registrationNumber:"",reportAccentColor:"#174f49"},f=(0,a.createContext)({settings:c,isLoaded:!1,refreshSettings:async()=>{},uiTheme:o,updateUITheme:()=>{},resetUITheme:()=>{},templates:[],saveTemplate:()=>{},deleteTemplate:()=>{},setDefaultTemplate:()=>{},getDefaultTemplate:()=>null});e.s(["SettingsProvider",0,function({children:e}){let[d,u]=(0,a.useState)(c),[p,m]=(0,a.useState)(!1),[y,h]=(0,a.useState)(o),[g,b]=(0,a.useState)([]);(0,a.useEffect)(()=>{h(i(s,o)),b(i(n,[]))},[]);let v=(0,a.useCallback)(async()=>{try{let e=await (0,r.apiFetch)("http://localhost:5000/api/settings");if(e.ok){let t=await e.json();u({withholdPercent:t.withholdPercent??2,creditGraceDays:t.creditGraceDays??30,cashGraceDays:t.cashGraceDays??3,expiryNotificationDays:t.expiryNotificationDays??60,expiryDisplayType:t.expiryDisplayType??"long",blockDirectInvoice:t.blockDirectInvoice??!1,companyName:t.companyName||"Nexlify",companyLogo:t.companyLogo||"",companyAddress:t.companyAddress||"",companyPhone:t.companyPhone||"",registrationNumber:t.registrationNumber||"",reportAccentColor:t.reportAccentColor||"#174f49"})}}catch(e){console.error("Failed to load settings:",e)}finally{m(!0)}},[]);(0,a.useEffect)(()=>{v()},[v]);let _=(0,a.useCallback)(e=>{h(t=>{let a={...t,...e};return l(s,a),a})},[]),x=(0,a.useCallback)(e=>{let t={primary:e,secondary:o.secondary,nav:e,badge:e,tabIndicator:e};h(t),l(s,t)},[]),T=(0,a.useCallback)(e=>{b(t=>{let a=t.findIndex(t=>t.id===e.id)>=0?t.map(t=>t.id===e.id?e:t):[...t,e];return l(n,a),a})},[]),j=(0,a.useCallback)(e=>{b(t=>{let a=t.filter(t=>t.id!==e);return l(n,a),a})},[]),k=(0,a.useCallback)(e=>{b(t=>{let a=t.map(t=>({...t,isDefault:t.id===e}));return l(n,a),a})},[]),w=(0,a.useCallback)(()=>g.find(e=>e.isDefault)??g[0]??null,[g]);return(0,t.jsx)(f.Provider,{value:{settings:d,isLoaded:p,refreshSettings:v,uiTheme:y,updateUITheme:_,resetUITheme:x,templates:g,saveTemplate:T,deleteTemplate:j,setDefaultTemplate:k,getDefaultTemplate:w},children:e})},"useSettings",0,function(){return(0,a.useContext)(f)}])},87771,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(22016),o=e.i(18566),s=e.i(54858);e.s(["default",0,function(){let e=(0,o.usePathname)(),n=(0,o.useRouter)(),[i,l]=(0,a.useState)(null),[c,f]=(0,a.useState)(null),[d,u]=(0,a.useState)(!1);(0,a.useEffect)(()=>{let e=localStorage.getItem("user");if(e)try{let t=JSON.parse(e);l(t),t.employeeId&&(0,s.apiFetch)(`http://localhost:5000/api/employees/${t.employeeId}`).then(e=>e.ok?e.json():null).then(e=>{e&&f(e)}).catch(()=>{})}catch(e){console.error("Failed to parse stored user",e)}},[e]),(0,a.useEffect)(()=>{u(!1)},[e]);let p=i?.role?.toLowerCase()||"sales_user",m="admin"===p||"administrator"===p,y="manager"===p||m,h="finance"===p||y,g="store_user"===p||y,b="sales_user"===p||y,v="cashier"===p||y||h,_="customer"===p,x=m||y,T=y||h||b||g||v,j=y||h||v,k=y||g||h,w=y||h||b||v,N=y||h||g||b||v,P=y||h||b||v,E=y||h||v,I=y||g||h;if("/login"===e)return null;let S=(()=>{switch(p){case"admin":case"administrator":return"#f87171";case"manager":return"#fb923c";case"finance":return"#818cf8";case"cashier":return"#22d3ee";case"store_user":return"#34d399";case"sales_user":return"#c084fc";case"customer":return"#f472b6";default:return"#fbbf24"}})(),C=(()=>{switch(p){case"admin":case"administrator":return"Admin";case"manager":return"Manager";case"finance":return"Finance";case"cashier":return"Cashier";case"store_user":return"Store";case"sales_user":return"Sales";case"customer":return"Customer";default:return p}})(),O=i?.username?i.username.charAt(0).toUpperCase():"?";return(0,t.jsxs)("aside",{className:`sidebar ${d?"mobile-open":""}`,children:[(0,t.jsxs)("div",{className:"sidebar-header",children:[(0,t.jsx)("div",{className:"sidebar-logo-icon",children:"🛍️"}),(0,t.jsx)("h2",{children:"Nexlify"}),(0,t.jsx)("button",{className:"mobile-hamburger",onClick:()=>u(!d),"aria-label":"Toggle navigation",children:d?"✕":"☰"})]}),(0,t.jsxs)("nav",{className:"sidebar-nav",children:[(0,t.jsx)("div",{className:"sidebar-section-label",children:"Main"}),!_&&"sales_user"!==p&&"cashier"!==p&&(0,t.jsxs)(r.default,{href:"/",className:`nav-item ${"/"===e?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📊"}),"Dashboard"]}),"cashier"===p&&(0,t.jsxs)(r.default,{href:"/cashier-dashboard",className:`nav-item ${"/cashier-dashboard"===e?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📊"}),"Cashier Dashboard"]}),"sales_user"===p&&(0,t.jsxs)(r.default,{href:"/seller-dashboard",className:`nav-item ${"/seller-dashboard"===e?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📊"}),"Seller Dashboard"]}),_&&(0,t.jsxs)(r.default,{href:"/customer-portal",className:`nav-item ${e.startsWith("/customer-portal")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"🏦"}),"Customer Portal"]}),(w||N||P||E)&&(0,t.jsx)("div",{className:"sidebar-section-label",children:"Operations"}),w&&(0,t.jsxs)(r.default,{href:"/customers",className:`nav-item ${e.startsWith("/customers")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"👥"}),"Customers"]}),N&&(0,t.jsxs)(r.default,{href:"/orders",className:`nav-item ${e.startsWith("/orders")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"🛒"}),"Orders"]}),P&&(0,t.jsxs)(r.default,{href:"/invoices",className:`nav-item ${e.startsWith("/invoices")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📄"}),"Invoices"]}),E&&(0,t.jsxs)(r.default,{href:"/payments",className:`nav-item ${e.startsWith("/payments")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"💰"}),"Payments"]}),(y||j||k||I)&&(0,t.jsx)("div",{className:"sidebar-section-label",children:"Management"}),y&&(0,t.jsxs)(r.default,{href:"/employees",className:`nav-item ${e.startsWith("/employees")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"👤"}),"Employees"]}),j&&(0,t.jsxs)(r.default,{href:"/banks",className:`nav-item ${e.startsWith("/banks")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"🏦"}),"Banks"]}),k&&(0,t.jsxs)(r.default,{href:"/inventory",className:`nav-item ${e.startsWith("/inventory")||e.startsWith("/price-list")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📦"}),"Inventory"]}),I&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("div",{className:"sidebar-section-label",style:{marginTop:"0.25rem",fontSize:"0.6rem",letterSpacing:"0.08em"},children:"Purchasing"}),(0,t.jsxs)(r.default,{href:"/purchasing/orders",className:`nav-item ${e.startsWith("/purchasing/orders")?"active":""}`,style:{paddingLeft:"1.5rem"},children:[(0,t.jsx)("span",{className:"icon",children:"📋"}),"Purchase Orders"]}),(0,t.jsxs)(r.default,{href:"/purchasing/purchases",className:`nav-item ${e.startsWith("/purchasing/purchases")?"active":""}`,style:{paddingLeft:"1.5rem"},children:[(0,t.jsx)("span",{className:"icon",children:"📥"}),"Purchases"]}),(0,t.jsxs)(r.default,{href:"/purchasing/suppliers",className:`nav-item ${e.startsWith("/purchasing/suppliers")?"active":""}`,style:{paddingLeft:"1.5rem"},children:[(0,t.jsx)("span",{className:"icon",children:"🏭"}),"Suppliers"]})]}),(y||h)&&(0,t.jsxs)(r.default,{href:"/import",className:`nav-item ${"/import"===e?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📥"}),"Import Sales"]}),(T||x||m)&&(0,t.jsx)("div",{className:"sidebar-section-label",children:"Insights & System"}),T&&(0,t.jsxs)(r.default,{href:"/reports",className:`nav-item ${e.startsWith("/reports")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"📊"}),"Reports"]}),x&&(0,t.jsxs)(r.default,{href:"/users",className:`nav-item ${e.startsWith("/users")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"🛡️"}),"Users"]}),m&&(0,t.jsxs)(r.default,{href:"/settings",className:`nav-item ${e.startsWith("/settings")?"active":""}`,children:[(0,t.jsx)("span",{className:"icon",children:"⚙️"}),"Settings"]})]}),(0,t.jsxs)("div",{className:"sidebar-footer",children:[(0,t.jsx)("div",{className:"sidebar-user-card",children:(0,t.jsxs)("div",{className:"sidebar-user-info",children:[(0,t.jsx)("div",{className:"sidebar-user-avatar",style:{background:`linear-gradient(135deg, ${S}, color-mix(in srgb, ${S} 70%, #000))`},children:O}),(0,t.jsxs)("div",{className:"sidebar-user-details",children:[(0,t.jsx)("div",{className:"sidebar-user-name",children:i?.username||"System User"}),c&&(0,t.jsxs)("div",{className:"sidebar-user-employee",children:[c.firstName," ",c.lastName]}),(0,t.jsx)("div",{className:"sidebar-user-role",style:{background:`color-mix(in srgb, ${S} 12%, transparent)`,color:S},children:C})]})]})}),(0,t.jsxs)("button",{className:"btn-logout",onClick:()=>{localStorage.removeItem("token"),localStorage.removeItem("user"),n.push("/login")},children:[(0,t.jsx)("span",{className:"icon",children:"🚪"}),"Sign Out"]})]})]})}])},1565,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(18566),o=e.i(22016),s=e.i(54858);e.s(["default",0,function(){let e=(0,r.useRouter)(),n=(0,r.usePathname)(),[i,l]=(0,a.useState)(null),[c,f]=(0,a.useState)(null),[d,u]=(0,a.useState)(null),[p,m]=(0,a.useState)([]),[y,h]=(0,a.useState)(!1),[g,b]=(0,a.useState)(!1),v=(0,a.useRef)(null),_=(0,a.useRef)(null);async function x(){try{let e=await (0,s.apiFetch)("http://localhost:5000/api/settings");if(e.ok){let t=await e.json();u(t)}}catch(e){console.error("Failed to fetch settings in TopNav:",e)}}(0,a.useEffect)(()=>{let e=e=>{v.current&&!v.current.contains(e.target)&&b(!1),_.current&&!_.current.contains(e.target)&&h(!1)};return document.addEventListener("mousedown",e),()=>document.removeEventListener("mousedown",e)},[]),(0,a.useEffect)(()=>{b(!1),h(!1);let e=localStorage.getItem("user");if(e)try{let t=JSON.parse(e);l(t),t.employeeId&&(0,s.apiFetch)(`http://localhost:5000/api/employees/${t.employeeId}`).then(e=>e.ok?e.json():null).then(e=>{e&&f(e)}).catch(()=>{})}catch(e){console.error("Failed to parse user session in TopNav:",e)}x()},[n]);let T=async()=>{try{let e=await (0,s.apiFetch)("http://localhost:5000/api/notifications");if(e.ok){let t=await e.json();m(t)}}catch(e){console.error("Failed to fetch notifications:",e)}};(0,a.useEffect)(()=>{T();let e=setInterval(T,3e4);return()=>clearInterval(e)},[]);let j=async()=>{try{await (0,s.apiFetch)("http://localhost:5000/api/notifications/read-all",{method:"PATCH"}),m(e=>e.map(e=>({...e,isRead:!0})))}catch(e){console.error("Failed to mark all as read:",e)}},k=async t=>{if(!t.isRead)try{await (0,s.apiFetch)(`http://localhost:5000/api/notifications/${t.id}/read`,{method:"PATCH"}),m(e=>e.map(e=>e.id===t.id?{...e,isRead:!0}:e))}catch(e){console.error("Failed to mark notification as read:",e)}t.link&&e.push(t.link)},w=p.filter(e=>!e.isRead).length,N=i?.username?i.username.slice(0,2).toUpperCase():"US";return"/login"===n?null:(0,t.jsxs)("header",{className:"top-nav",children:[(0,t.jsxs)("div",{className:"top-nav-left",style:{display:"flex",alignItems:"center",gap:"0.75rem"},children:[(0,t.jsx)("button",{className:"top-nav-hamburger",onClick:()=>{let e=document.querySelector(".sidebar");e&&e.classList.toggle("mobile-open")},"aria-label":"Toggle navigation",style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1.2rem",color:"#e2e8f0",flexShrink:0},children:"☰"}),(0,t.jsxs)(o.default,{href:"/",style:{display:"flex",alignItems:"center",gap:"0.75rem",textDecoration:"none"},children:[d?.companyLogo?(0,t.jsx)("img",{src:d.companyLogo.startsWith("data:image")?d.companyLogo:`data:image/png;base64,${d.companyLogo}`,alt:"Company Logo",style:{height:"36px",width:"auto",objectFit:"contain",borderRadius:"4px"}}):(0,t.jsx)("span",{style:{fontSize:"1.75rem",display:"flex",alignItems:"center"},children:"🏢"}),(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"column"},children:[(0,t.jsx)("span",{style:{fontSize:"1.05rem",fontWeight:800,color:"#fff",letterSpacing:"0.5px",lineHeight:1.2},children:d?.companyName||"Nexlify"}),(0,t.jsx)("span",{style:{fontSize:"0.65rem",color:"#6ee7b7",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px"},children:"Inventory & Payment Hub"})]})]})]}),(0,t.jsxs)("div",{className:"top-nav-right",children:[(0,t.jsxs)("div",{ref:_,style:{position:"relative"},children:[(0,t.jsxs)("button",{className:"top-nav-icon-btn",onClick:()=>{h(!y),b(!1)},"aria-label":"View notifications",children:[(0,t.jsx)("span",{style:{fontSize:"1.25rem"},children:"🔔"}),w>0&&(0,t.jsx)("span",{className:"notif-badge",children:w})]}),y&&(0,t.jsxs)("div",{className:"top-nav-dropdown notif-dropdown",children:[(0,t.jsxs)("div",{className:"dropdown-header",children:[(0,t.jsx)("span",{style:{fontWeight:700,color:"#fff"},children:"Notifications"}),w>0&&(0,t.jsx)("button",{onClick:j,className:"text-btn",children:"Mark all read"})]}),(0,t.jsx)("div",{className:"dropdown-body",children:p.map(e=>(0,t.jsxs)("div",{className:`notif-item ${!e.isRead?"unread":""}`,onClick:()=>k(e),style:{cursor:e.link?"pointer":"default"},children:[(0,t.jsx)("div",{className:"notif-bullet"}),(0,t.jsxs)("div",{style:{flex:1},children:[(0,t.jsxs)("p",{style:{margin:0,fontSize:"0.8rem",color:"#e2e8f0",lineHeight:1.3},children:[e.title,": ",e.message]}),(0,t.jsx)("span",{style:{fontSize:"0.7rem",color:"var(--text-muted)",marginTop:"0.2rem",display:"block"},children:new Date(e.createdAt).toLocaleString()})]})]},e.id))})]})]}),(0,t.jsx)("div",{style:{width:"1px",height:"24px",background:"rgba(255, 255, 255, 0.08)"}}),(0,t.jsxs)("div",{ref:v,style:{position:"relative"},children:[(0,t.jsxs)("button",{className:"top-nav-profile-trigger",onClick:()=>{b(!g),h(!1)},children:[(0,t.jsx)("div",{className:"user-avatar",children:N}),(0,t.jsxs)("div",{className:"user-info-text",children:[(0,t.jsx)("span",{className:"username-label",children:i?.username||"User Account"}),c&&(0,t.jsxs)("span",{className:"employee-name-label",children:[c.firstName," ",c.lastName]}),(0,t.jsx)("span",{className:"role-label",children:i?.role||"Guest"})]}),(0,t.jsx)("span",{style:{fontSize:"0.75rem",color:"var(--text-muted)",marginLeft:"0.25rem"},children:"▼"})]}),g&&(0,t.jsxs)("div",{className:"top-nav-dropdown profile-dropdown",children:[(0,t.jsxs)("div",{className:"dropdown-profile-header",children:[(0,t.jsx)("div",{className:"large-avatar",children:N}),(0,t.jsxs)("div",{children:[(0,t.jsx)("h4",{style:{margin:0,color:"#fff",fontSize:"0.9rem"},children:i?.username}),c&&(0,t.jsxs)("span",{style:{fontSize:"0.75rem",color:"#60a5fa",display:"block",marginTop:"0.1rem"},children:[c.firstName," ",c.middleName," ",c.lastName]}),(0,t.jsx)("span",{style:{fontSize:"0.75rem",color:"#6ee7b7",textTransform:"uppercase",fontWeight:700},children:i?.role})]})]}),(0,t.jsx)("div",{className:"dropdown-divider"}),(0,t.jsxs)(o.default,{href:"/settings",className:"dropdown-link-item",onClick:()=>b(!1),children:[(0,t.jsx)("span",{children:"⚙️"})," Settings & Profile"]}),(0,t.jsxs)(o.default,{href:"/inventory?tab=products",className:"dropdown-link-item",onClick:()=>b(!1),children:[(0,t.jsx)("span",{children:"📦"})," Inventory Catalog"]}),(0,t.jsxs)(o.default,{href:"/price-list",className:"dropdown-link-item",onClick:()=>b(!1),children:[(0,t.jsx)("span",{children:"📋"})," Price List"]}),(0,t.jsx)("div",{className:"dropdown-divider"}),(0,t.jsxs)("button",{onClick:()=>{localStorage.removeItem("token"),localStorage.removeItem("user"),e.push("/login")},className:"dropdown-action-btn logout-btn",children:[(0,t.jsx)("span",{children:"🚪"})," Sign Out"]})]})]})]})]})}])},67585,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"BailoutToCSR",{enumerable:!0,get:function(){return o}});let r=e.r(32061);function o({reason:e,children:t}){if("u"<typeof window)throw Object.defineProperty(new r.BailoutToCSRError(e),"__NEXT_ERROR_CODE",{value:"E394",enumerable:!1,configurable:!0});return t}},9885,(e,t,a)=>{"use strict";function r(e){return e.split("/").map(e=>encodeURIComponent(e)).join("/")}Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"encodeURIPath",{enumerable:!0,get:function(){return r}})},52157,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"PreloadChunks",{enumerable:!0,get:function(){return l}});let r=e.r(43476),o=e.r(74080),s=e.r(63599),n=e.r(9885),i=e.r(43369);function l({moduleIds:e}){if("u">typeof window)return null;let t=s.workAsyncStorage.getStore();if(void 0===t)return null;let a=[];if(t.reactLoadableManifest&&e){let r=t.reactLoadableManifest;for(let t of e){if(!r[t])continue;let e=r[t].files;a.push(...e)}}if(0===a.length)return null;let c=(0,i.getAssetTokenQuery)();return(0,r.jsx)(r.Fragment,{children:a.map(e=>{let a=`${t.assetPrefix}/_next/${(0,n.encodeURIPath)(e)}${c}`;return e.endsWith(".css")?(0,r.jsx)("link",{precedence:"dynamic",href:a,rel:"stylesheet",as:"style",nonce:t.nonce},e):((0,o.preload)(a,{as:"script",fetchPriority:"low",nonce:t.nonce}),null)})})}},69093,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"default",{enumerable:!0,get:function(){return c}});let r=e.r(43476),o=e.r(71645),s=e.r(67585),n=e.r(52157);function i(e){return{default:e&&"default"in e?e.default:e}}let l={loader:()=>Promise.resolve(i(()=>null)),loading:null,ssr:!0},c=function(e){let t={...l,...e},a=(0,o.lazy)(()=>t.loader().then(i)),c=t.loading;function f(e){let i=c?(0,r.jsx)(c,{isLoading:!0,pastDelay:!0,error:null}):null,l=!t.ssr||!!t.loading,f=l?o.Suspense:o.Fragment,d=t.ssr?(0,r.jsxs)(r.Fragment,{children:["u"<typeof window?(0,r.jsx)(n.PreloadChunks,{moduleIds:t.modules}):null,(0,r.jsx)(a,{...e})]}):(0,r.jsx)(s.BailoutToCSR,{reason:"next/dynamic",children:(0,r.jsx)(a,{...e})});return(0,r.jsx)(f,{...l?{fallback:i}:{},children:d})}return f.displayName="LoadableComponent",f}},70703,(e,t,a)=>{"use strict";Object.defineProperty(a,"__esModule",{value:!0}),Object.defineProperty(a,"default",{enumerable:!0,get:function(){return o}});let r=e.r(55682)._(e.r(69093));function o(e,t){let a={};"function"==typeof e&&(a.loader=e);let o={...a,...t};return(0,r.default)({...o,modules:o.loadableGenerated?.modules})}("function"==typeof a.default||"object"==typeof a.default&&null!==a.default)&&void 0===a.default.__esModule&&(Object.defineProperty(a.default,"__esModule",{value:!0}),Object.assign(a.default,a),t.exports=a.default)},50011,e=>{"use strict";var t=e.i(43476);let a=(0,e.i(70703).default)(()=>e.A(58420),{loadableGenerated:{modules:[60123]},ssr:!1});e.s(["default",0,function(){return(0,t.jsx)(a,{})}])},1423,e=>{"use strict";var t=e.i(43476);let a=(0,e.i(70703).default)(()=>e.A(89689),{loadableGenerated:{modules:[45404]},ssr:!1});e.s(["default",0,function(){return(0,t.jsx)(a,{})}])},97931,e=>{"use strict";var t=e.i(71645),a=e.i(54858);e.s(["default",0,function(){let e=(0,t.useRef)(!1);return(0,t.useEffect)(()=>{if("serviceWorker"in navigator&&"PushManager"in window&&!e.current&&localStorage.getItem("token"))return e.current=!0,t(),()=>{e.current=!1};async function t(){try{let e=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;let t=await e.pushManager.getSubscription();t&&await t.unsubscribe();let r=await Notification.requestPermission();if("granted"!==r)return;let o=(await e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:"BEzPpJDchW2HWFnsWu_6o_92j6Ed3ELTF1mDDtYQ2-xdQ1lFPsa10Zxia-AKQQMZgLM46jy7piOPKULI1I2hh5Q"})).toJSON();await (0,a.apiFetch)("http://localhost:5000/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:o.endpoint,keys:o.keys})})}catch(e){console.error("Push subscription failed:",e)}}},[]),null}])},52790,e=>{"use strict";var t=e.i(71645),a=e.i(54858);!function(){let e=window;if(e.__apiFetchPatched)return;let t=e.fetch.bind(e);e.__apiFetchOriginal=t,e.__apiFetchPatched=!0,e.fetch=(e,r)=>t((0,a.normalizeApiRequest)(e),r)}(),e.s(["default",0,function(){return(0,t.useEffect)(()=>()=>{let e=window;e.__apiFetchOriginal&&(e.fetch=e.__apiFetchOriginal),delete e.__apiFetchOriginal,delete e.__apiFetchPatched},[]),null}])},79536,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(69052);function o(e){let t=e.replace("#","");return[parseInt(t.slice(0,2),16)||0,parseInt(t.slice(2,4),16)||0,parseInt(t.slice(4,6),16)||0]}function s(){let{uiTheme:e,settings:t}=(0,r.useSettings)();return(0,a.useEffect)(()=>{let t,a,r,s,n,i=document.documentElement,l=(t=e.primary,/^#[0-9a-fA-F]{6}$/.test(t))?e.primary:"#174f49",[c,f,d]=o(l);i.style.setProperty("--ui-primary",l),i.style.setProperty("--accent-color",l),i.style.setProperty("--accent",l),i.style.setProperty("--accent-glow",`rgba(${c},${f},${d},0.3)`),i.style.setProperty("--accent-hover",function(e,t=20){let[a,r,s]=o(e),n=Math.min(255,a+t).toString(16).padStart(2,"0"),i=Math.min(255,r+t).toString(16).padStart(2,"0"),l=Math.min(255,s+t).toString(16).padStart(2,"0");return`#${n}${i}${l}`}(l,18));let u=(a=e.secondary,/^#[0-9a-fA-F]{6}$/.test(a))?e.secondary:"#475569",[p,m,y]=o(u);i.style.setProperty("--ui-secondary",u),i.style.setProperty("--ui-secondary-bg",`rgba(${p},${m},${y},0.1)`);let h=(r=e.nav,/^#[0-9a-fA-F]{6}$/.test(r))?e.nav:"#38bdf8",[g,b,v]=o(h);i.style.setProperty("--ui-nav",h),i.style.setProperty("--ui-nav-bg",`rgba(${g},${b},${v},0.08)`),i.style.setProperty("--ui-nav-border",`rgba(${g},${b},${v},0.15)`);let _=(s=e.badge,/^#[0-9a-fA-F]{6}$/.test(s))?e.badge:l,[x,T,j]=o(_);i.style.setProperty("--ui-badge",_),i.style.setProperty("--ui-badge-bg",`rgba(${x},${T},${j},0.15)`);let k=(n=e.tabIndicator,/^#[0-9a-fA-F]{6}$/.test(n))?e.tabIndicator:l;i.style.setProperty("--ui-tab",k)},[e,t.reportAccentColor]),null}e.s(["default",0,function({children:e}){return(0,t.jsxs)(r.SettingsProvider,{children:[(0,t.jsx)(s,{}),e]})}])},58420,e=>{e.v(t=>Promise.all(["static/chunks/03pji54-.n~sb.js","static/chunks/00m2i0h~d00rm.js","static/chunks/05t52-gbq_24~.js"].map(t=>e.l(t))).then(()=>t(60123)))},89689,e=>{e.v(t=>Promise.all(["static/chunks/0ris8cj~bs70s.js"].map(t=>e.l(t))).then(()=>t(45404)))}]);