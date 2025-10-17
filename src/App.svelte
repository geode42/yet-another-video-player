<script lang="ts">
    import Player from './lib/Player.svelte'
</script>

{#snippet title()}
    <strong>Spring - Blender Open Movie</strong> <span style='color: #FFF8'>(CC) Blender Foundation | studio.blender.org</span>
{/snippet}

<main>
    <Player src='Spring - Blender Open Movie.webm' {title} startFocused />
</main>

<style>
    main {
        height: 100svh;
    }
</style>
