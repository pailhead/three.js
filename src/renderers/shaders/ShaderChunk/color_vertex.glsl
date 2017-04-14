#ifdef INSTANCE_COLOR

	vColor.xyz = instanceColor.xyz;

#elif defined(USE_COLOR)

	vColor.xyz = color.xyz;

#endif
