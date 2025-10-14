<script lang="ts">
    import Player from './lib/Player.svelte';
</script>

{#snippet title()}
    <strong>Spring</strong> <span style='color: #FFF8'>- Blender Open Movie</span>
{/snippet}

<main>
    <Player src={'/Spring - Blender Open Movie.webm'} {title} />
</main>

<style>
    main {
        height: 100svh;
    }
</style>
