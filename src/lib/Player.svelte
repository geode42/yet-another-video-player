<script lang='ts'>
    import { onDestroy, onMount } from 'svelte'
    import icon_play_arrow from '../assets/material-symbols/play_arrow_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import icon_pause from '../assets/material-symbols/pause_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import icon_volume_up from '../assets/material-symbols/volume_up_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import icon_volume_down from '../assets/material-symbols/volume_down_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import icon_volume_off from '../assets/material-symbols/volume_off_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import icon_closed_caption from '../assets/material-symbols/closed_caption_24dp_CURRENTCOLOR_FILL0_wght400_GRAD0_opsz24.svg?raw'
    import { VolumeController } from './VolumeController.svelte'

    let { src, title, startFocused = false }: { src: string, title?: any, startFocused?: boolean } = $props()

    export const focus = () => containerElement.focus()

    let containerElement: HTMLDivElement
    let videoElement: HTMLVideoElement
    let seekBar: HTMLDivElement
    let seekBarClickArea: HTMLDivElement
    let controlsBarStack: HTMLDivElement
    let volumeSlider: HTMLDivElement

    let paused = $state(true)
    let volumeController = $state(new VolumeController(1))
    let currentTime = $state(0)
    let duration = $state(1)
    let fullscreen = $state(false)
    let overlayVisible = $state(true) // Whether the GUI overlay is shown, resetOverlay() should be used to change this
    let overlayHovered = $state({ // on yt hovering over empty space on the controls bar at the bottom doesn't prevent the overlay from fading out
        seekBar: false,
        left: false,
        right: false,
    })

    // svelte-ignore state_referenced_locally
    let resumeAfterSeeking = false // When you seek the video becomes paused and this variable is set to whether the video was playing. Then when you finish seeking, if this was set to true, it resumes
    let overlayFadeoutTimeoutId: number
    const overlayFadeoutDelay = 3000

    // Click to play / Double click to fullscreen vars
    // TODO: this is still bugged apparently (edit: setting the max difference to 2 might've fixed it?)
    const clickToPlayPauseDelay = 180 // When you click on the video to play/pause it, this delay is added to not interfere with double clicking to toggle fullscreen
    let clickToPlayPauseTimeout: number // The ID of the timeout established when you click on the video that toggles the paused state
    let previousClickToPlayTimestamp = NaN // The timestamp of the previous pointerup on the video, used to figure out whether the video paused state was toggled prematurely
    let lastDoubleClickToFullscreenTimestamp = NaN // The timestamp of the most recent double click on the video

    // when using bind:volume svelte keeps calling the volume controller's volume setter when you toggle mute for some reason
    // so this seems to have to be done manually to avoid that
    $effect(() => {
        videoElement.volume = volumeController.volume
    })

    $effect(() => {
        // these tell svelte to react whenever these variables change
        paused
        volumeController
        fullscreen
        overlayHovered
        resetOverlayVisibilityAndTimeout()
    })

    // fullscreen handling
    $effect(() => {
        if (fullscreen) {
            containerElement.requestFullscreen()
        } else if (document.fullscreenElement == containerElement) { // check that the container is in fact in fullscreen, otherwise svelte runs at the beginning of every page load
            document.exitFullscreen()
        }
    })

    function resetOverlayVisibilityAndTimeout() {
        overlayVisible = true
        clearTimeout(overlayFadeoutTimeoutId)
        if (!paused && !Object.values(overlayHovered).some(i => i) && !controlsBarStack.contains(document.activeElement)) {
            overlayFadeoutTimeoutId = setTimeout(() => overlayVisible = false, overlayFadeoutDelay)
        }
    }

    function windowKeydownListener(e: KeyboardEvent) {
        if (!containerElement.contains(document.activeElement)) return
        if (document.activeElement?.tagName == 'BUTTON') return
        const keyBindings: Record<string, () => void> = {
            ' ': () => paused = !paused,
            'k': () => paused = !paused,
            'f': () => fullscreen = !fullscreen,
            'm': () => volumeController.toggleMute(),
            'ArrowUp': () => volumeController.volume += 0.05,
            'ArrowDown': () => volumeController.volume -= 0.05,
            'ArrowLeft': () => currentTime = Math.max(0, currentTime - 5),
            'ArrowRight': () => currentTime = Math.min(duration, currentTime + 5),
            'j': () => Math.max(0, currentTime - 10),
            'l': () => Math.min(duration, currentTime + 10),
        }
        if (e.key in keyBindings) {
            keyBindings[e.key]()
        }
    }

    onMount(() => {
        if (startFocused) containerElement.focus()
        // on yt clicking doesn't necessarily prevent the overlay from hiding, only mouse movement seems to universally be tracked. so i'm doing the same here
        // clicking on buttons will still update the vars the effect above is checking, so that's handled
        containerElement.addEventListener('pointermove', resetOverlayVisibilityAndTimeout)

        videoElement.addEventListener('durationchange', () => {
            duration = videoElement.duration
        })

        // Hide overlay if mouse cursor leaves the player (or if the event is otherwise fired)
        containerElement.addEventListener('pointerleave', () => {
            if (!paused) {
                clearTimeout(overlayFadeoutTimeoutId)
                overlayVisible = false
            }
        })

        // double clicks trigger on pointerup
        containerElement.addEventListener('pointerup', async e => {
            if (!(e.target == containerElement || e.target == videoElement)) return
            // The dblclick event fires shortly after pointer down/up events,
            // but this functions needs to know whether a double click occured,
            // so this defers execution to after everything else
            await new Promise<void>(r => setTimeout(() => r()))

            // If this pointerup seems to have triggered a dblclick, skip the play pausing below this block (the return is the main/important part here)
            if (Math.abs(e.timeStamp - lastDoubleClickToFullscreenTimestamp) < 2) {
                // To improve responsiveness, the delay before playing/pausing could be shorter than the OS's
                // dblclick delay, in which case the video would have been play/paused when it should've been.
                // This play/pauses it again to fix it
                if (e.timeStamp - previousClickToPlayTimestamp > clickToPlayPauseDelay) paused = !paused
                return
            }
            if (e.button == 0) clickToPlayPauseTimeout = setTimeout(() => paused = !paused, clickToPlayPauseDelay)
            previousClickToPlayTimestamp = e.timeStamp
        })

        containerElement.addEventListener('dblclick', e => {
            if (!(e.target == containerElement || e.target == videoElement)) return
            clearTimeout(clickToPlayPauseTimeout)
            lastDoubleClickToFullscreenTimestamp = e.timeStamp
            fullscreen = !fullscreen
        })


        addEventListener('keydown', windowKeydownListener)

        /* -------------------------------- Seek Bar -------------------------------- */

        function calculateSeekBarTimeFromPosition(x: number) {
            const seekBarRect = seekBar.getBoundingClientRect()
            return duration * Math.max(0, Math.min(1, ((x - seekBarRect.x) / seekBarRect.width)))
        }

        seekBarClickArea.addEventListener('pointerdown', e => {
            if (e.button != 0) return

            currentTime = calculateSeekBarTimeFromPosition(e.clientX)

            seekBarClickArea.setPointerCapture(e.pointerId)
            resumeAfterSeeking = !paused
            paused = true
        })

        seekBarClickArea.addEventListener('pointermove', e => {
            if (!seekBarClickArea.hasPointerCapture(e.pointerId)) return
            if (e.buttons != 1) return
            getSelection()?.removeAllRanges()
            currentTime = calculateSeekBarTimeFromPosition(e.clientX)
        })

        seekBarClickArea.addEventListener('pointerup', e => {
            if (e.button != 0) return
            if (resumeAfterSeeking) paused = false
        })

        /* ------------------------------ Volume Slider ----------------------------- */

        function calculateVolumeSliderValueFromPosition(x: number) {
            const volumeSliderRect = volumeSlider.getBoundingClientRect()
            // the volume controller already clamps the volume, but whatevs
            return Math.max(0, Math.min(1, ((x - volumeSliderRect.x) / volumeSliderRect.width)))
        }

        volumeSlider.addEventListener('pointerdown', e => {
            if (e.button != 0) return

            volumeController.volume = calculateVolumeSliderValueFromPosition(e.clientX)
            volumeSlider.setPointerCapture(e.pointerId)
        })

        volumeSlider.addEventListener('pointermove', e => {
            if (!volumeSlider.hasPointerCapture(e.pointerId)) return
            if (e.buttons != 1) return
            getSelection()?.removeAllRanges()
            volumeController.volume = calculateVolumeSliderValueFromPosition(e.clientX)
        })
    })

    onDestroy(() => {
        removeEventListener('keydown', windowKeydownListener)
    })

    function formatTime(seconds: number) {
        const hours = String(Math.floor(seconds / 3600))
        const minutes = String(Math.floor(seconds / 60 % 60))
        const secs = String(Math.floor(seconds % 60))
        if (hours != '0') return `${hours}:${minutes.padStart(2, '0')}:${secs.padStart(2, '0')}`
        return `${minutes}:${secs.padStart(2, '0')}`
    }


</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="container" bind:this={containerElement} class:paused={paused} class:overlays-hidden={!overlayVisible} tabindex="0">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video {src} bind:paused={paused} bind:this={videoElement} bind:currentTime={currentTime}></video>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="controls-bar-stack" bind:this={controlsBarStack}>
        <div class="seek-bar" bind:this={seekBar} onmouseenter={() => overlayHovered.seekBar = true} onmouseleave={() => overlayHovered.seekBar = false}>
            <div class="watched" style:width={`${currentTime / duration * 100}%`}></div>
            <div class="scrubber"></div>
            <div class="remaining"></div>
            <div class="click-area" bind:this={seekBarClickArea}></div>
        </div>
        <div class="controls">
            <div class="left" onmouseenter={() => overlayHovered.left = true} onmouseleave={() => overlayHovered.left = false}>
                <button onclick={() => paused = !paused} aria-label='Play/Pause' class='play-pause-button'>
                    {#if paused}
                        {@html icon_play_arrow}
                    {:else}
                        {@html icon_pause}
                    {/if}
                </button>

                <button class='toggle-mute-button {volumeController.mute ? 'muted' : volumeController.volume > 0.5 ? 'high-volume' : 'low-volume'}' onclick={() => volumeController.toggleMute()}>
                    {#if volumeController.mute} {@html icon_volume_off}
                    {:else if volumeController.volume > 0.5} {@html icon_volume_up}
                    {:else} {@html icon_volume_down}
                    {/if}
                </button>
                <div class="volume-slider-wrapper">
                    <div class="volume-slider" bind:this={volumeSlider}>
                        <div class="left" style:width={`${volumeController.volume * 100}%`}></div>
                        <div class="handle"></div>
                        <div class="right"></div>
                    </div>
                </div>

                <div class="time-container">
                    <span class="elapsed">{formatTime(currentTime)}</span>
                    <span class="divider">/</span>
                    <span class="remaining">{formatTime(duration)}</span>
                </div>

                <div class="title">
                    {#if title}
                        {@render title()}
                    {/if}
                </div>
            </div>

            <div class="right"  onmouseenter={() => overlayHovered.right = true} onmouseleave={() => overlayHovered.right = false}>
                <button disabled>
                    {@html icon_closed_caption}
                </button>
                <button class="fullscreen-button" aria-label="Toggle fullscreen" onclick={() => fullscreen = !fullscreen}>
                    <!-- the svg's below are modified versions of 'Fullscreen' and 'Fullscreen Exit' from Material Symbols at 500 weight -->
                    {#if fullscreen}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M315.22-315.22H157.37q-19.15 0-32.33-13.17-13.17-13.18-13.17-32.33t13.17-32.32q13.18-13.18 32.33-13.18h203.35q19.15 0 32.32 13.18 13.18 13.17 13.18 32.32v203.35q0 19.15-13.18 32.33-13.17 13.17-32.32 13.17t-32.33-13.17q-13.17-13.18-13.17-32.33zm329.8 0v157.85q0 19.15-13.17 32.33-13.18 13.17-32.33 13.17t-32.32-13.17q-13.18-13.18-13.18-32.33v-203.35q0-19.15 13.18-32.32 13.17-13.18 32.32-13.18h203.11q19.15 0 32.33 13.18 13.17 13.17 13.17 32.32t-13.17 32.33q-13.18 13.17-32.33 13.17zm-329.8-329.8v-157.61q0-19.15 13.17-32.33 13.18-13.17 32.33-13.17t32.32 13.17q13.18 13.18 13.18 32.33v203.11q0 19.15-13.18 32.32-13.17 13.18-32.32 13.18H157.37q-19.15 0-32.33-13.18-13.17-13.17-13.17-32.32t13.17-32.33q13.18-13.17 32.33-13.17zm329.8 0h157.61q19.15 0 32.33 13.17 13.17 13.18 13.17 32.33t-13.17 32.32q-13.18 13.18-32.33 13.18H599.52q-19.15 0-32.32-13.18-13.18-13.17-13.18-32.32v-203.11q0-19.15 13.18-32.33 13.17-13.17 32.32-13.17t32.33 13.17q13.17 13.18 13.17 32.33z"/></svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 -960 960 960"><path d="M202.87-202.87h157.85q19.15 0 32.32 13.17 13.18 13.18 13.18 32.33t-13.18 32.33q-13.17 13.17-32.32 13.17H157.37q-19.15 0-32.33-13.17-13.17-13.18-13.17-32.33v-203.35q0-19.15 13.17-32.32 13.18-13.18 32.33-13.18t32.33 13.18q13.17 13.17 13.17 32.32zm554.26 0v-157.85q0-19.15 13.17-32.32 13.18-13.18 32.33-13.18t32.33 13.18q13.17 13.17 13.17 32.32v203.35q0 19.15-13.17 32.33-13.18 13.17-32.33 13.17H599.52q-19.15 0-32.32-13.17-13.18-13.18-13.18-32.33t13.18-32.33q13.17-13.17 32.32-13.17zM202.87-757.13v157.61q0 19.15-13.17 32.32-13.18 13.18-32.33 13.18t-32.33-13.18q-13.17-13.17-13.17-32.32v-203.11q0-19.15 13.17-32.33 13.18-13.17 32.33-13.17h203.35q19.15 0 32.32 13.17 13.18 13.18 13.18 32.33t-13.18 32.33q-13.17 13.17-32.32 13.17zm554.26 0H599.52q-19.15 0-32.32-13.17-13.18-13.18-13.18-32.33t13.18-32.33q13.17-13.17 32.32-13.17h203.11q19.15 0 32.33 13.17 13.17 13.18 13.17 32.33v203.11q0 19.15-13.17 32.32-13.18 13.18-32.33 13.18T770.3-567.2q-13.17-13.17-13.17-32.32z"/></svg>
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    *, *::before, *::after {
        box-sizing: content-box;
    }
    .container {
        font-family: JetBrainsMono;
        width: 100%;
        height: 100%;
        position: relative;
        background: black;
        --overlay-color: #FFFC;
        --seekbar-remaining-color: #FFF4;
    }
    video {
        position: absolute;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        max-width: 100%;
        max-height: 100%;
        margin: auto;
    }

    .controls-bar-stack {
        position: absolute;
        inset: 0;
        top: unset;
        display: flex;
        flex-direction: column;
        color: var(--overlay-color);
        transition: opacity 200ms;

        button {
            background: transparent;
            border: none;
            color: var(--overlay-color);
            cursor: pointer;
            display: grid;
            place-items: center;
            padding: 0;
            transition: color 50ms;

            &:hover {
                color: white;
            }

            &:disabled {
                color: #FFF6;
                cursor: default;
            }
        }

        :global(svg) {
            height: 1em;
            width: auto;
        }
    }

    .container.overlays-hidden {
        cursor: none;

        .controls-bar-stack {
            opacity: 0;
        }
    }

    .seek-bar {
        --watched-height: 0.2rem;
        --inline-margin: 1.5rem;
        width: calc(100% - 2 * var(--inline-margin));
        margin-inline: auto;
        position: relative;
        display: flex;
        height: 0;
        /* it makes animations and stuff a lot simpler if everything was always vertically aligned and stretched outwards/inwards, so this container has a height of 0 */
        /* but that causes it to clip into the controls below, so a margin is added to shift it up. since .watched is the tallest portion of the bar (as of writing, and scrubber doesn't count), it gets shifted up by half its height */
        margin-bottom: calc(var(--watched-height) / 2);
        align-items: center;

        .watched {
            height: var(--watched-height);
            background: red;
        }

        .watched, .remaining {
            transition: height 100ms;
        }

        &:has(.click-area:hover) {
            .watched, .remaining {
                height: 0.32rem;
            }
        }

        .click-area {
            position: absolute;
            inset: 0;
            top: unset;
            translate: 0 calc(var(--watched-height) / 2);
            height: 1.5rem;
            cursor: pointer;
            /* background: #0F08; */
        }

        .scrubber {
            width: 0;
            position: relative;

            &::after {
                content: '';
                position: absolute;
                display: block;
                width: 1.35rem;
                aspect-ratio: 1;
                top: 50%;
                left: 50%;
                translate: -50% -50%;
                background: red;
                border-radius: 100%;
            }
        }

        .remaining {
            flex-grow: 1;
            height: 0.15rem;
            background: var(--seekbar-remaining-color);
        }
    }

    .controls {
        display: flex;
        justify-content: space-between;
        pointer-events: none;

        > * {
            display: flex;
            align-items: center;
            pointer-events: all;
        }

        button {
            height: 6.5rem;
            font-size: 2.3rem;
            aspect-ratio: 1;
        }
    }

    .container .play-pause-button {
        font-size: 3rem;
    }

    .container.paused .play-pause-button {
        font-size: 3.5rem;
    }

    .time-container {
        font-size: 1.1rem;
        margin-right: 3rem;
    }

    .title {
        font-size: 1.1rem;
    }
    
    /* fix alignment for volume-down icon */
    .toggle-mute-button.low-volume {
        translate: -0.083em;
    }

    :has(:is(.toggle-mute-button, .volume-slider-wrapper):hover) .volume-slider-wrapper {
        width: calc(var(--slider-width) + var(--slider-handle-padding) * 2);
        margin-right: 0;
    }

    .volume-slider-wrapper {
        --slider-width: 7rem;
        --slider-handle-padding: 1.5rem;
        --slider-wrapper-right-padding: 2rem; /* the buttons get some visual padding with small icons, but this slider goes almost edge to edge so extra padding is added */
        width: 0;
        overflow: hidden;
        transition: width 300ms, margin 300ms;
        height: 100%;
        margin-left: -0.5rem;
        margin-right: var(--slider-wrapper-right-padding);
    }

    .volume-slider {
        width: var(--slider-width);
        height: 100%;
        display: flex;
        align-items: center;
        cursor: pointer;
        margin-left: var(--slider-handle-padding);

        .left {
            height: 0.2rem;
            background: white;
        }

        .right {
            flex-grow: 1;
            height: 0.2rem;
            background: var(--seekbar-remaining-color);
        }

        .handle {
            width: 0;
            &::after {
                content: '';
                display: block;
                width: 1.2em;
                translate: -50% 0;
                aspect-ratio: 1;
                background: white;
                border-radius: 100%;
            }
        }
    }
</style>