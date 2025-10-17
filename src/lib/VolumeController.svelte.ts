export class VolumeController {
    #volume = $state(1)
    #unmuteVolume = 1

    constructor(volume: number) {
        this.volume = volume
    }

    set volume(volume: number) {
        volume = Math.max(0, Math.min(1, volume))
        this.#volume = volume
        this.#unmuteVolume = volume || 1 // if volume is set to 0 (i.e. manually muted), the unmute volume goes back to the default -- 1
    }

    get volume(): number {
        return this.#volume
    }

    set mute(mute: boolean) {
        this.#volume = mute ? 0 : this.#unmuteVolume // changes '#volume' instead of the setter to not modify unmuteVolume
    }

    get mute(): boolean {
        return !this.#volume
    }

    toggleMute() {
        this.mute = !this.mute
    }
}
